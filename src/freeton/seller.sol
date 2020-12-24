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
}