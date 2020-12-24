pragma solidity >= 0.6.0;

import "data.sol";

/// @title Buyer contract
/// @author ftkvyn
contract Buyer {
    PriceRequest[] requests;
    mapping(address => PriceResponce) responces;

    constructor() public {
        require(tvm.pubkey() != 0, 101);
        require(msg.pubkey() == tvm.pubkey(), 102);
        tvm.accept();
    }
}