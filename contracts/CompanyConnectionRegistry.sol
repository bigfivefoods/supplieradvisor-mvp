// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CompanyConnectionRegistry
 * @notice Onchain registry for verifiable company-to-company connections.
 *         Designed for SupplierAdvisor / Big Five Group ecosystem.
 *         Connections are mutual and require explicit acceptance.
 */
contract CompanyConnectionRegistry {
    // ============================================================
    //                          ENUMS
    // ============================================================
    enum ConnectionStatus {
        None,        // No relationship
        Requested,   // One party has requested a connection
        Connected,   // Mutually accepted connection
        Rejected     // Request was rejected
    }

    // ============================================================
    //                          STRUCTS
    // ============================================================
    struct Connection {
        ConnectionStatus status;
        uint256 requestedAt;
        uint256 connectedAt;
        address requestedBy;
    }

    // ============================================================
    //                          STORAGE
    // ============================================================
    // companyA => companyB => Connection
    // We store both directions for fast lookup (A→B and B→A)
    mapping(address => mapping(address => Connection)) private _connections;

    // ============================================================
    //                          EVENTS
    // ============================================================
    event ConnectionRequested(
        address indexed from,
        address indexed to,
        uint256 timestamp
    );

    event ConnectionAccepted(
        address indexed from,
        address indexed to,
        uint256 timestamp
    );

    event ConnectionRejected(
        address indexed from,
        address indexed to,
        uint256 timestamp
    );

    event ConnectionRevoked(
        address indexed from,
        address indexed to,
        uint256 timestamp
    );

    // ============================================================
    //                          CUSTOM ERRORS
    // ============================================================
    error CannotConnectToSelf();
    error ConnectionAlreadyExists();
    error NoConnectionRequest();
    error NotAuthorized();
    error InvalidConnectionStatus();

    // ============================================================
    //                          EXTERNAL FUNCTIONS
    // ============================================================

    /**
     * @notice Request a connection with another company
     * @param _to The wallet address of the company you want to connect with
     */
    function requestConnection(address _to) external {
        if (msg.sender == _to) revert CannotConnectToSelf();

        Connection storage existing = _connections[msg.sender][_to];

        if (existing.status == ConnectionStatus.Requested || 
            existing.status == ConnectionStatus.Connected) {
            revert ConnectionAlreadyExists();
        }

        _connections[msg.sender][_to] = Connection({
            status: ConnectionStatus.Requested,
            requestedAt: block.timestamp,
            connectedAt: 0,
            requestedBy: msg.sender
        });

        // Mirror the request in the other direction for easy lookup
        _connections[_to][msg.sender] = Connection({
            status: ConnectionStatus.Requested,
            requestedAt: block.timestamp,
            connectedAt: 0,
            requestedBy: msg.sender
        });

        emit ConnectionRequested(msg.sender, _to, block.timestamp);
    }

    /**
     * @notice Accept a connection request from another company
     * @param _from The wallet address that requested the connection
     */
    function acceptConnection(address _from) external {
        Connection storage connection = _connections[_from][msg.sender];

        if (connection.status != ConnectionStatus.Requested) {
            revert NoConnectionRequest();
        }

        connection.status = ConnectionStatus.Connected;
        connection.connectedAt = block.timestamp;

        // Update the mirrored connection
        Connection storage mirror = _connections[msg.sender][_from];
        mirror.status = ConnectionStatus.Connected;
        mirror.connectedAt = block.timestamp;

        emit ConnectionAccepted(_from, msg.sender, block.timestamp);
    }

    /**
     * @notice Reject a connection request
     * @param _from The wallet address that requested the connection
     */
    function rejectConnection(address _from) external {
        Connection storage connection = _connections[_from][msg.sender];

        if (connection.status != ConnectionStatus.Requested) {
            revert NoConnectionRequest();
        }

        connection.status = ConnectionStatus.Rejected;

        // Update mirror
        _connections[msg.sender][_from].status = ConnectionStatus.Rejected;

        emit ConnectionRejected(_from, msg.sender, block.timestamp);
    }

    /**
     * @notice Revoke an existing connection (can be called by either party)
     * @param _otherCompany The other company's wallet address
     */
    function revokeConnection(address _otherCompany) external {
        Connection storage connection = _connections[msg.sender][_otherCompany];

        if (connection.status != ConnectionStatus.Connected) {
            revert InvalidConnectionStatus();
        }

        connection.status = ConnectionStatus.None;
        _connections[_otherCompany][msg.sender].status = ConnectionStatus.None;

        emit ConnectionRevoked(msg.sender, _otherCompany, block.timestamp);
    }

    // ============================================================
    //                          VIEW FUNCTIONS
    // ============================================================

    /**
     * @notice Get the connection status between two companies
     */
    function getConnectionStatus(address _a, address _b)
        external
        view
        returns (ConnectionStatus)
    {
        return _connections[_a][_b].status;
    }

    /**
     * @notice Get full connection details between two companies
     */
    function getConnection(address _a, address _b)
        external
        view
        returns (Connection memory)
    {
        return _connections[_a][_b];
    }

    /**
     * @notice Check if two companies are currently connected
     */
    function areConnected(address _a, address _b) external view returns (bool) {
        return _connections[_a][_b].status == ConnectionStatus.Connected;
    }
}