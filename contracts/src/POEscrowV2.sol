// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract POEscrowV2 is ReentrancyGuard, Ownable {
    enum POStatus {
        Created,     // 0
        Funded,      // 1
        Delivered,   // 2  ← NEW
        Completed,   // 3
        Cancelled    // 4
    }

    struct PurchaseOrder {
        uint256 id;
        address buyer;
        address supplier;
        uint256 amount;
        string description;
        uint256 deadline;
        POStatus status;
        uint256 fundedAmount;
        bool supplierConfirmedDelivery;
        bool buyerApprovedRelease;
    }

    uint256 public poCounter;
    mapping(uint256 => PurchaseOrder) public purchaseOrders;

    event POCreated(uint256 indexed poId, address indexed buyer, address indexed supplier, uint256 amount);
    event POFunded(uint256 indexed poId, uint256 amount);
    event DeliveryConfirmed(uint256 indexed poId, address supplier);
    event FundsReleased(uint256 indexed poId, address supplier, uint256 amount);
    event PORefunded(uint256 indexed poId, address buyer, uint256 amount);
    event POCancelled(uint256 indexed poId);

    constructor() Ownable(msg.sender) {}

    function createPO(
        address _supplier,
        uint256 _amount,
        string memory _description,
        uint256 _deadline
    ) external returns (uint256) {
        require(_supplier != address(0), "Invalid supplier");
        require(_amount > 0, "Amount must be greater than 0");
        require(_deadline > block.timestamp, "Deadline must be in the future");

        poCounter++;
        uint256 newPoId = poCounter;

        purchaseOrders[newPoId] = PurchaseOrder({
            id: newPoId,
            buyer: msg.sender,
            supplier: _supplier,
            amount: _amount,
            description: _description,
            deadline: _deadline,
            status: POStatus.Created,
            fundedAmount: 0,
            supplierConfirmedDelivery: false,
            buyerApprovedRelease: false
        });

        emit POCreated(newPoId, msg.sender, _supplier, _amount);
        return newPoId;
    }

    function fundPO(uint256 _poId) external payable nonReentrant {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(po.id != 0, "PO does not exist");
        require(po.buyer == msg.sender, "Only buyer can fund");
        require(po.status == POStatus.Created, "PO must be in Created status");
        require(msg.value >= po.amount, "Insufficient funding amount");

        po.fundedAmount = msg.value;
        po.status = POStatus.Funded;

        emit POFunded(_poId, msg.value);
    }

    function confirmDelivery(uint256 _poId) external {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(po.supplier == msg.sender, "Only supplier can confirm delivery");
        require(po.status == POStatus.Funded, "PO must be Funded");
        require(!po.supplierConfirmedDelivery, "Delivery already confirmed");
        require(block.timestamp <= po.deadline, "Deadline has passed");

        po.supplierConfirmedDelivery = true;
        po.status = POStatus.Delivered;           // ← Now properly moves to Delivered

        emit DeliveryConfirmed(_poId, msg.sender);
    }

    function releaseFunds(uint256 _poId) external nonReentrant {
        PurchaseOrder storage po = purchaseOrders[_poId];
        
        require(po.buyer == msg.sender, "Only buyer can release funds");
        require(po.status == POStatus.Delivered, "PO must be in Delivered status");
        require(po.supplierConfirmedDelivery, "Supplier must confirm delivery first");
        require(!po.buyerApprovedRelease, "Funds already released");

        po.buyerApprovedRelease = true;
        po.status = POStatus.Completed;

        (bool success, ) = po.supplier.call{value: po.amount}("");
        require(success, "Transfer to supplier failed");

        emit FundsReleased(_poId, po.supplier, po.amount);
    }

    function refundPO(uint256 _poId) external nonReentrant {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(po.buyer == msg.sender, "Only buyer can request refund");
        require(po.status == POStatus.Funded || po.status == POStatus.Created, "Cannot refund at this stage");
        require(!po.supplierConfirmedDelivery, "Cannot refund after delivery confirmed");

        po.status = POStatus.Cancelled;

        uint256 refundAmount = po.fundedAmount;
        po.fundedAmount = 0;

        (bool success, ) = po.buyer.call{value: refundAmount}("");
        require(success, "Refund transfer failed");

        emit PORefunded(_poId, po.buyer, refundAmount);
    }

    // View functions
    function getPO(uint256 _poId) external view returns (PurchaseOrder memory) {
        return purchaseOrders[_poId];
    }

    function getPOStatus(uint256 _poId) external view returns (POStatus) {
        return purchaseOrders[_poId].status;
    }
}