pragma solidity >= 0.6.0;

import "data.sol";

/// @title Buyer contract
/// @author ftkvyn
contract Buyer {
    mapping(uint => PriceRequest) requests;
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
    function getQuota(PriceResponce responce) public onlyOnChain {
        // slice sender_addr = msg_slice~load_msg_addr();
        // (int wc, int seller_addr_int) = sender_addr.parse_std_addr();
        // dump_stack();
        // int query_id = in_msg~load_uint(32);
        // slice resp_body = in_msg~load_ref().begin_parse();

        // int price = resp_body~load_grams();
        // int status = resp_body~load_uint(4);
        // int expires = resp_body~load_uint(32);
        // cell goods_dict = resp_body~load_dict();
        // dump_stack();

        // (int stored_seqno, int public_key, cell requests_dict, cell responses_dict, cell info) = load_internal_data();

        // responses_dict = save_price_response(responses_dict, price, seller_addr_int, query_id, expires, goods_dict);

        // save_internal_data(stored_seqno, public_key, requests_dict, responses_dict, info);
	}

    /// External functions, called by the owner

    function createPriceRequest(PriceRequest request) public onlyOwner {
        // TBD
    }

    function sendPriceRequest(uint req_id, address seller) public onlyOwner {
        // TBD
    }

    function sendPayment(uint req_id, address seller) public onlyOwner {
        // TBD
    }

    function cleanupStaleData() public onlyOwner {
        // TBD
    }
}