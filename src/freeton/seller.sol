pragma solidity >= 0.6.0;

import "data.sol";

/// @title Seller contract
/// @author ftkvyn
contract Seller {
    bool public is_open;
    uint  max_anon_requests;
    uint  max_request_per_user;
    uint[] products;
    mapping(address => bool) clients; // true if is active, false for blocked;
    mapping(address => PriceRequest) requests;
    mapping(address => PriceResponce) responces;

    constructor() public {
        require(tvm.pubkey() != 0, 101);
        require(msg.pubkey() == tvm.pubkey(), 102);
        tvm.accept();
    }

    modifier onlyOwner {
        require(msg.pubkey() == tvm.pubkey(), 102);
        tvm.accept();
        _;
    }

    modifier onlyOnChain {
        require(msg.sender != 0, 109);
		_;
    }

    /// Internal, on-chain functions

    function recievePriceRequest(PriceRequest request) public onlyOnChain {
        // TBD
    }

    function recievePayment(uint req_id) public onlyOnChain {
        // TBD
    }

    /// External functions, called by the owner

    function respondWithQuota() public onlyOwner {
        // TBD
    }

    function cleanupClientData(address clientToRemove) public onlyOwner {
        // TBD
    }

    function cleanupStaleData() public onlyOwner {
        // TBD
    }

    function changeIsOpen(bool isOpen) public onlyOwner {
        // TBD
    }

    function updateProduct(uint productId, bool isAdd) public onlyOwner {
        // TBD
    }

    /// Getters

    function getClientOrders(address client) public view returns (PriceRequest[] requests) {
        // TBD
    }

    function getProducts() public view returns (uint[] activeProducts) {
        // TBD
    }

    function getIsOpen() public view returns (bool isOpen) {
        // TBD
    }
}