pragma solidity >= 0.6.0;

struct Product {
    uint product_id;
    uint quantity;
}

struct PriceRequest {
    uint req_id;
    Product[] products;
    uint32 expiry;
}

struct PriceResponce {
    uint req_id;
    Product[] products;
    uint[] missing_products;
    uint128 price;
    uint32 expiry;
}