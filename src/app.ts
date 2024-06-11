import dotenv from "dotenv";

import { SendMode, Address, beginCell, internal, toNano, Cell, StateInit, storeStateInit } from "ton-core";

import { OpenedWallet, openWallet } from "./utils";
import { sleep, waitSeqno } from "./delay";
import { TonClient } from "ton";

dotenv.config();

export type Nft = {
  nftItemAddress: Address;
  ownerIndex: number;
  price: bigint;
  isListed: boolean;
  saleContractAddress: Address | null;
};

async function sell(wallet: OpenedWallet, nftAddress: Address, price: bigint): Promise<Address | null>{
  try {
    const NftFixPriceSaleV3R2CodeBoc = Cell.fromBase64('te6cckECCwEAArkAART/APSkE/S88sgLAQIBIAMCAH7yMO1E0NMA0x/6QPpA+kD6ANTTADDAAY4d+ABwB8jLABbLH1AEzxZYzxYBzxYB+gLMywDJ7VTgXweCAP/+8vACAUgFBABXoDhZ2omhpgGmP/SB9IH0gfQBqaYAYGGh9IH0AfSB9ABhBCCMkrCgFYACqwECAs0IBgH3ZghA7msoAUmCgUjC+8uHCJND6QPoA+kD6ADBTkqEhoVCHoRagUpBwgBDIywVQA88WAfoCy2rJcfsAJcIAJddJwgKwjhdQRXCAEMjLBVADzxYB+gLLaslx+wAQI5I0NOJacIAQyMsFUAPPFgH6AstqyXH7AHAgghBfzD0UgcAlsjLHxPLPyPPFlADzxbKAIIJycOA+gLKAMlxgBjIywUmzxZw+gLLaszJgwb7AHFVUHAHyMsAFssfUATPFljPFgHPFgH6AszLAMntVAH30A6GmBgLjYSS+CcH0gGHaiaGmAaY/9IH0gfSB9AGppgBgYOCmE44BgAEqYhOmPhW8Q4YBKGATpn8cIxbMbC3MbK2QV44LJOZlvKAVxFWAAyS+G8BJrpOEBFcCBFd0VYACRWdjYKdxjgthOjq+G6hhoaYPqGAD9gHAU4ADAkB6PLRlLOOQjEzOTlTUscFkl8J4FFRxwXy4fSCEAUTjZEWuvLh9QP6QDBGUBA0WXAHyMsAFssfUATPFljPFgHPFgH6AszLAMntVOAwNyjAA+MCKMAAnDY3EDhHZRRDMHDwBeAIwAKYVUQQJBAj8AXgXwqED/LwCgDUODmCEDuaygAYvvLhyVNGxwVRUscFFbHy4cpwIIIQX8w9FCGAEMjLBSjPFiH6Astqyx8Vyz8nzxYnzxYUygAj+gITygDJgwb7AHFQZkUVBHAHyMsAFssfUATPFljPFgHPFgH6AszLAMntVOBqUYM=');

  // mainnet
  // const marketplaceAddress = Address.parse('EQBYTuYbLf8INxFtD8tQeNk5ZLy-nAX9ahQbG_yl1qQ-GEMS'); // GetGems Address
  // const marketplaceFeeAddress = Address.parse('EQCjk1hh952vWaE9bRguFkAhDAL5jj3xj9p0uPWrFBq_GEMS'); // GetGems Address for Fees
  // const destinationAddress = Address.parse("EQAIFunALREOeQ99syMbO6sSzM_Fa1RsPD5TBoS0qVeKQ-AR"); // GetGems sale contracts deployer
  // const royaltyAddress = Address.parse('');

  const marketplaceAddress = Address.parse('kQDZwUjVjK__PvChXCvtCMshBT1hrPKMwzRhyTAtonUbL9i9'); // GetGems Address
  const marketplaceFeeAddress = Address.parse('0QD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6xti'); // GetGems Address for Fees
  const destinationAddress = Address.parse("kQDZwUjVjK__PvChXCvtCMshBT1hrPKMwzRhyTAtonUbL9i9"); // GetGems sale contracts deployer
  const royaltyAddress = Address.parse('0QAaONCYuRbx4pgDtSsGV-nCeVD8FkrYizvvbWxnuShYVVJg');
  const walletAddress = wallet.contract.address;
    const feesData = beginCell()
        .storeAddress(marketplaceFeeAddress)
        // 5% - GetGems fee
        .storeCoins(price / BigInt(100) * BigInt(5))
        .storeAddress(royaltyAddress)
        // 5% - Royalty, can be changed
        .storeCoins(price / BigInt(100) * BigInt(20))
        .endCell();

    const saleData = beginCell()
        .storeBit(0) // is_complete
        .storeUint(Math.round(Date.now() / 1000), 32) // created_at
        .storeAddress(marketplaceAddress) // marketplace_address
        .storeAddress(nftAddress) // nft_address
        .storeAddress(walletAddress) // previous_owner_address
        .storeCoins(price) // full price in nanotons
        .storeRef(feesData) // fees_cell
        .storeBit(0) // can_be_deployed_externally
        .endCell();

    const stateInit: StateInit = {
        code: NftFixPriceSaleV3R2CodeBoc,
        data: saleData
    };
    const stateInitCell = beginCell()
        .store(storeStateInit(stateInit))
        .endCell();

    // not needed, just for example
    const saleContractAddress = new Address(0, stateInitCell.hash());
    console.log(`sale contract address of ${nftAddress.toString()} is ${saleContractAddress.toString()}`)

    const saleBody = beginCell()
        .storeUint(1, 32) // just accept coins on deploy
        .storeUint(0, 64)
        .endCell();

    const transferNftBody = beginCell()
        .storeUint(0x5fcc3d14, 32) // Opcode for NFT transfer
        .storeUint(0, 64) // query_id
        .storeAddress(destinationAddress) // new_owner
        .storeAddress(walletAddress) // response_destination for excesses
        .storeBit(0) // we do not have custom_payload
        .storeCoins(toNano("0.2")) // forward_amount
        .storeBit(0) // we store forward_payload is this cell
        // not 32, because we stored 0 bit before | do_sale opcode for deployer
        .storeUint(0x0fe0ede, 31)
        .storeRef(stateInitCell)
        .storeRef(saleBody)
        .endCell();

  let seqno = await wallet.contract.getSeqno();
  await wallet.contract.sendTransfer({
    seqno,
    secretKey: wallet.keyPair.secretKey,
    messages: [
      internal({
        value: "0.25",
        to: nftAddress, // nft item
        body: transferNftBody
      })
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
  });
  await waitSeqno(seqno, wallet);

  return saleContractAddress;
  } catch (error) {
    console.log(error);
    return null;
  }
}

async function buy(wallet: OpenedWallet, saleContractAddress: Address, price: bigint): Promise<boolean>{
  try {
    let seqno = await wallet.contract.getSeqno();
    await wallet.contract.sendTransfer({
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          value: price,
          to: saleContractAddress, // sale contract address
        })
      ],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    });
    await waitSeqno(seqno, wallet);

    console.log(`buy nft item of sale contract: ${saleContractAddress.toString()}`)
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

function getRandomWithExclusion(start:number, end:number, exclude:number[]) {
  let numbers = Array.from({length: end-start+1}, (_, i) => start + i);
  numbers = numbers.filter(num => !exclude.includes(num));
  return numbers[Math.floor(Math.random() * numbers.length)];
}

async function getRandomBuyWallet(listAccount: OpenedWallet[], excludeIndex: number, price: bigint): Promise<{account: OpenedWallet, index: number} | null> {
  let excludes = [excludeIndex];
  let buyWalletIndex = getRandomWithExclusion(0, listAccount.length - 1, excludes);
  let buyWallet = listAccount[buyWalletIndex];
  excludes.push(buyWalletIndex);
  let balance = await getAddressBalance(buyWallet.contract.address);

  while(buyWallet && balance < price) {
    console.log(buyWallet.contract.address.toString(), balance, price)
    buyWalletIndex = getRandomWithExclusion(0, listAccount.length - 1, excludes);
    buyWallet = listAccount[buyWalletIndex];
    if(buyWallet){
      balance = await getAddressBalance(buyWallet.contract.address);
    }
  }

  if(buyWallet){
    return {
      account: buyWallet,
      index: buyWalletIndex
    };
  }

  return null;
}

async function getAddressBalance(
  account: Address,
): Promise<bigint> {
  const client = new TonClient({
    endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TONCENTER_API_KEY,
  });
  return client.getBalance(account)
}

async function init() {
  const wallet_1 = await openWallet(process.env.MNEMONIC_1!.split(" "), true);
  const wallet_2 = await openWallet(process.env.MNEMONIC_2!.split(" "), true);
  let listNft: Nft[] = [{
    nftItemAddress: Address.parse("kQBsncoWq0GRZ3NMkr87qvW2HnrAxcqDhJzMiH0rl82AulOH"),
    ownerIndex: 1,
    price: toNano("10"),
    isListed: false,
    saleContractAddress: null
  }];

  let listAccount: OpenedWallet[] = [wallet_1, wallet_2];

  let cusor = 0;
  while(cusor < 100){
    for(let i = 0; i < listNft.length; i++){
      console.log(`------------${i}-----------`, listNft[i])
      if(listNft[i].isListed){
        const buyEntity = await getRandomBuyWallet(listAccount, listNft[i].ownerIndex, listNft[i].price + toNano("1"));
        if(!buyEntity) continue;
        const isBought = await buy(buyEntity.account, listNft[i].saleContractAddress!, listNft[i].price + toNano("1"));
        if(isBought){
          listNft[i].ownerIndex = buyEntity.index;
          listNft[i].isListed = false;
          listNft[i].saleContractAddress = null;
        }

        await sleep(30000);
        continue;
      }
  
      const saleContractAddress = await sell(listAccount[listNft[i].ownerIndex], listNft[i].nftItemAddress, listNft[i].price + toNano("0.25"));
      if(saleContractAddress){
        listNft[i].saleContractAddress = saleContractAddress;
        listNft[i].isListed = true;
        listNft[i].price += toNano("0.5");
        await sleep(30000);
      }
    }

    cusor++;
  }
}

void init();
