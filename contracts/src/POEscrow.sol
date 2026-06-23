// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract POEscrow is Ownable, ReentrancyGuard {
    enum POStatus {
        Created,
        Funded,
        Delivered,
        Completed,
        Cancelled
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

    uint256 public nextPOId = 1;
    mapping(uint256 => PurchaseOrder) public purchaseOrders;

    event POCreated(
        uint256 indexed poId,
        address indexed buyer,
        address indexed supplier,
        uint256 amount,
        string description
    );

    event POFunded(uint256 indexed poId, uint256 amount);
    event DeliveryConfirmed(uint256 indexed poId, address supplier);
    event FundsReleased(uint256 indexed poId, address supplier, uint256 amount);
    event PORefunded(uint256 indexed poId, address buyer, uint256 amount);
    event POCancelled(uint256 indexed poId);

    constructor() Ownable(msg.sender) {}

    // ==================== CREATE PO ====================
    function createPO(
        address _supplier,
        uint256 _amount,
        string memory _description,
        uint256 _deadline
    ) external returns (uint256) {
        require(_supplier != address(0), "Invalid supplier");
        require(_amount > 0, "Amount must be greater than 0");
        require(_deadline > block.timestamp, "Deadline must be in the future");

        uint256 poId = nextPOId++;

        purchaseOrders[poId] = PurchaseOrder({
            id: poId,
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

        emit POCreated(poId, msg.sender, _supplier, _amount, _description);
        return poId;
    }

    // ==================== FUND ESCROW ====================
    function fundPO(uint256 _poId) external payable nonReentrant {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(po.id != 0, "PO does not exist");
        require(msg.sender == po.buyer, "Only buyer can fund");
        require(po.status == POStatus.Created, "PO already funded or cancelled");
        require(msg.value >= po.amount, "Insufficient funding amount");

        po.fundedAmount = msg.value;
        po.status = POStatus.Funded;

        emit POFunded(_poId, msg.value);
    }

    // ==================== SUPPLIER CONFIRMS DELIVERY ====================
    function confirmDelivery(uint256 _poId) external {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(po.id != 0, "PO does not exist");
        require(msg.sender == po.supplier, "Only supplier can confirm");
        require(po.status == POStatus.Funded, "PO must be funded first");

        po.supplierConfirmedDelivery = true;
        emit DeliveryConfirmed(_poId, msg.sender);
    }

    // ==================== BUYER RELEASES FUNDS ====================
    function releaseFunds(uint256 _poId) external nonReentrant {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(po.id != 0, "PO does not exist");
        require(msg.sender == po.buyer, "Only buyer can release funds");
        require(po.status == POStatus.Funded, "PO must be funded");
        require(po.supplierConfirmedDelivery, "Supplier has not confirmed delivery");

        po.buyerApprovedRelease = true;
        po.status = POStatus.Completed;

        uint256 amount = po.fundedAmount;
        (bool success, ) = po.supplier.call{value: amount}("");
        require(success, "Transfer to supplier failed");

        emit FundsReleased(_poId, po.supplier, amount);
    }

    // ==================== REFUND (if cancelled or expired) ====================
    function refundPO(uint256 _poId) external nonReentrant {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(po.id != 0, "PO does not exist");
        require(msg.sender == po.buyer, "Only buyer can request refund");
        require(
            po.status == POStatus.Funded || po.status == POStatus.Created,
            "Cannot refund this PO"
        );

        po.status = POStatus.Cancelled;

        if (po.fundedAmount > 0) {
            uint256 refundAmount = po.fundedAmount;
            po.fundedAmount = 0;

            (bool success, ) = po.buyer.call{value: refundAmount}("");
            require(success, "Refund transfer failed");

            emit PORefunded(_poId, po.buyer, refundAmount);
        } else {
            emit POCancelled(_poId);
        }
    }

    // ==================== VIEW FUNCTIONS ====================
    function getPO(uint256 _poId) external view returns (PurchaseOrder memory) {
        return purchaseOrders[_poId];
    }

    function getPOStatus(uint256 _poId) external view returns (POStatus) {
        return purchaseOrders[_poId].status;
    }
}