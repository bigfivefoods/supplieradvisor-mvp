// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SupplierRegistry is Ownable {
    struct Supplier {
        address wallet;
        string tradingName;
        string legalName;
        string category;
        uint8 status;           // 0=Pending, 1=Verified, 2=Suspended
        uint256 registeredAt;
        bool exists;
    }

    mapping(address => Supplier) private _suppliers;

    event SupplierRegistered(address indexed wallet, string tradingName, uint256 timestamp);
    event SupplierVerified(address indexed wallet, uint256 timestamp);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function registerSupplier(
        string memory tradingName,
        string memory legalName,
        string memory category
    ) external {
        require(!_suppliers[msg.sender].exists, "Supplier already registered");

        _suppliers[msg.sender] = Supplier({
            wallet: msg.sender,
            tradingName: tradingName,
            legalName: legalName,
            category: category,
            status: 0,
            registeredAt: block.timestamp,
            exists: true
        });

        emit SupplierRegistered(msg.sender, tradingName, block.timestamp);
    }

    function verifySupplier(address supplierWallet) external onlyOwner {
        require(_suppliers[supplierWallet].exists, "Supplier does not exist");
        _suppliers[supplierWallet].status = 1;
        emit SupplierVerified(supplierWallet, block.timestamp);
    }

    function getSupplier(address wallet) external view returns (Supplier memory) {
        return _suppliers[wallet];
    }

    function isVerified(address wallet) external view returns (bool) {
        return _suppliers[wallet].status == 1;
    }
}
