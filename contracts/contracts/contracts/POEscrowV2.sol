pragma solidity ^0.8.28;

contract POEscrowV2 {
    address public owner;
    uint256 public nextPOId;

    struct PurchaseOrder {
        uint256 id;
        address buyer;
        address supplier;
        uint256 amount;
        string metadataURI;
        uint8 status;
        uint256 createdAt;
        uint256 fundedAt;
    }

    mapping(uint256 => PurchaseOrder) public purchaseOrders;
    mapping(uint256 => uint256) public escrowedAmounts;

    event PO_Created(uint256 indexed poId, address indexed buyer, address indexed supplier, uint256 amount, string metadataURI);
    event PO_Funded(uint256 indexed poId, uint256 amount);
    event PO_Shipped(uint256 indexed poId);
    event PO_Delivered(uint256 indexed poId);
    event PO_Disputed(uint256 indexed poId, string reason);
    event PO_Resolved(uint256 indexed poId, address winner, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        nextPOId = 1;
    }

    function createPO(address _supplier, uint256 _amount, string calldata _metadataURI) external returns (uint256) {
        uint256 poId = nextPOId++;
        purchaseOrders[poId] = PurchaseOrder({
            id: poId, buyer: msg.sender, supplier: _supplier, amount: _amount,
            metadataURI: _metadataURI, status: 0, createdAt: block.timestamp, fundedAt: 0
        });
        emit PO_Created(poId, msg.sender, _supplier, _amount, _metadataURI);
        return poId;
    }

    function fundPO(uint256 _poId) external payable {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(po.id != 0 && po.status == 0 && msg.value == po.amount && msg.sender == po.buyer, "Invalid");
        po.status = 1; po.fundedAt = block.timestamp; escrowedAmounts[_poId] = msg.value;
        emit PO_Funded(_poId, msg.value);
    }

    function markShipped(uint256 _poId) external {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(po.status == 1 && msg.sender == po.supplier, "Invalid");
        po.status = 2; emit PO_Shipped(_poId);
    }

    function confirmDelivery(uint256 _poId) external {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(po.status == 2 && msg.sender == po.buyer, "Invalid");
        po.status = 3;
        payable(po.supplier).transfer(escrowedAmounts[_poId]);
        escrowedAmounts[_poId] = 0;
        emit PO_Delivered(_poId);
    }

    function raiseDispute(uint256 _poId, string calldata _reason) external {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require((po.status == 2 || po.status == 3) && (msg.sender == po.buyer || msg.sender == po.supplier), "Invalid");
        po.status = 4; emit PO_Disputed(_poId, _reason);
    }

    function resolveDispute(uint256 _poId, address _winner) external onlyOwner {
        PurchaseOrder storage po = purchaseOrders[_poId];
        require(po.status == 4, "Not disputed");
        po.status = 5;
        uint256 amt = escrowedAmounts[_poId];
        if (amt > 0) { payable(_winner).transfer(amt); escrowedAmounts[_poId] = 0; }
        emit PO_Resolved(_poId, _winner, amt);
    }

    function getPO(uint256 _poId) external view returns (PurchaseOrder memory) {
        return purchaseOrders[_poId];
    }
}
