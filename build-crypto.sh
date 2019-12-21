#!/bin/bash
rm ./dist -r
mkdir ./dist
mkdir ./dist/seller
mkdir ./dist/buyer
rm ./temp/*.fif
func -AP -O0 -o ./temp/new-seller-programm.fif ./src/crypto/lib/stdlib.fc ./src/crypto/common.fc ./src/crypto/seller.fc

cp ./src/crypto/price-response.fif ./dist/seller/price-response.fif
cp ./src/crypto/edit-goods.fif ./dist/seller/edit-goods.fif
cp ./src/crypto/open-close-seller.fif ./dist/seller/open-close-seller.fif
cp ./src/crypto/key-update.fif ./dist/seller/key-update.fif
cp ./src/crypto/cleanup-expired.fif ./dist/seller/cleanup-expired.fif
cp ./src/crypto/send-grams.fif ./dist/seller/send-grams.fif


cp ./src/crypto/price-request-create.fif ./dist/buyer/price-request-create.fif
cp ./src/crypto/price-request-send.fif ./dist/buyer/price-request-send.fif
cp ./src/crypto/pay-for-request.fif ./dist/buyer/pay-for-request.fif
cp ./src/crypto/key-update.fif ./dist/buyer/key-update.fif
cp ./src/crypto/cleanup-expired.fif ./dist/buyer/cleanup-expired.fif
cp ./src/crypto/send-grams.fif ./dist/buyer/send-grams.fif

cat ./temp/new-seller-programm.fif ./src/crypto/test/const_code.fif ./src/crypto/test/init-c7.fif ./src/crypto/test/test-0_script.fif > ./temp/test-0.fif
cat ./temp/new-seller-programm.fif ./src/crypto/test/const_code.fif ./src/crypto/test/init-c7.fif ./src/crypto/test/test-1_script.fif > ./temp/test-1.fif
cat ./temp/new-seller-programm.fif ./src/crypto/test/const_code.fif ./src/crypto/test/init-c7.fif ./src/crypto/test/test-2_script.fif > ./temp/test-2.fif
cat ./temp/new-seller-programm.fif ./src/crypto/test/const_code.fif ./src/crypto/test/init-c7.fif ./src/crypto/test/test-3_script.fif > ./temp/test-3.fif
cat ./temp/new-seller-programm.fif ./src/crypto/test/const_code.fif ./src/crypto/test/init-c7.fif ./src/crypto/test/test-4_script.fif > ./temp/test-4.fif
cat ./temp/new-seller-programm.fif ./src/crypto/new-seller_script.fif > ./dist/seller/new-seller.fif

mkdir -p temp
cd temp
fift -s ./test-0.fif
fift -s ./test-1.fif
fift -s ./test-2.fif
fift -s ./test-3.fif
fift -s ./test-4.fif


cd ..
func -AP -O0 -o ./temp/new-buyer-programm.fif ./src/crypto/lib/stdlib.fc ./src/crypto/common.fc ./src/crypto/buyer.fc
cat ./temp/new-buyer-programm.fif ./src/crypto/test/const_code.fif ./src/crypto/test/init-c7.fif ./src/crypto/test/test-5_script.fif > ./temp/test-5.fif
cat ./temp/new-buyer-programm.fif ./src/crypto/new-buyer_script.fif > ./dist/buyer/new-buyer.fif

cp ./dist -r ./temp/

cd temp
fift -s ./test-5.fif