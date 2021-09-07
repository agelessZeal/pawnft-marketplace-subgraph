import { log, BigInt, JSONValue, Value, ipfs  } from "@graphprotocol/graph-ts"
import {
  pawNFT,
  Approval,
  BidAddedToItem,
  ItemCreated,
  ItemImported,
  AuctionCancelled,
  ListCancelled,
  ItemSold,
  UpdatedSupportCurrency,
  Transfer as TransferEvent
} from "../generated/pawNFT/pawNFT"

import { PaymentCurrency, Bid, Item, Token, Owner, Transfer, Contract } from "../generated/schema"

export function handleUpdatedSupportedCurrency(event: UpdatedSupportCurrency): void {
  let entity = PaymentCurrency.load(event.params.currency.toHex())

  if(!entity) {
    entity = new PaymentCurrency(event.params.currency.toHex())
  }

  entity.acceptable = event.params.acceptable
  entity.save()
}

export function handleItemCreated(event: ItemCreated): void {
  let itemId = event.params.itemId
  let entity = Item.load(itemId.toString())

  if (entity == null) {
    entity = new Item(itemId.toString())
  }

  let instance = pawNFT.bind(event.address);
  entity.creator = event.transaction.from;

  let item = instance.try_items(itemId);
  if (!item.reverted) {
    let itemData = item.value.toMap();
    entity.collection = itemData.get('value1').toAddress();
    entity.tokenId    = itemData.get('value2').toBigInt();
    entity.mintable   = itemData.get('value3').toBoolean();
    entity.creator    = itemData.get('value4').toAddress();
    entity.uri        = itemData.get('value5').toString();
    entity.totalCount = itemData.get('value6').toBigInt();
    entity.count      = itemData.get('value6').toBigInt();
    entity.price      = itemData.get('value7').toBigInt();
    entity.currency   = itemData.get('value8').toAddress();
    entity.auctionable= itemData.get('value9').toBoolean();
    entity.startTime  = itemData.get('value10').toBigInt();
    entity.endTime    = itemData.get('value11').toBigInt();
    
    let condition = itemData.get('value12').toTuple();
    entity.requiredAKA = condition[0].toBigInt();
  } else {
    return;
  }

  entity.isSold = false;
  entity.blockTimestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.transactionHash = event.transaction.hash
  entity.save()
}



export function handleItemImported(event: ItemImported): void {
  let itemId = event.params.itemId
  let entity = Item.load(itemId.toString())

  if (entity == null) {
    entity = new Item(itemId.toString())
  }

  let instance = pawNFT.bind(event.address);
  let item = instance.try_items(itemId);
  if (!item.reverted) {
    let itemData = item.value.toMap();
    entity.collection = itemData.get('value1').toAddress();
    entity.tokenId    = itemData.get('value2').toBigInt();
    entity.mintable   = itemData.get('value3').toBoolean();
    entity.creator    = itemData.get('value4').toAddress();
    entity.uri        = itemData.get('value5').toString();
    entity.totalCount = itemData.get('value6').toBigInt();
    entity.count      = itemData.get('value6').toBigInt();
    entity.price      = itemData.get('value7').toBigInt();
    entity.currency   = itemData.get('value8').toAddress();
    entity.auctionable= itemData.get('value9').toBoolean();
    entity.startTime  = itemData.get('value10').toBigInt();
    entity.endTime    = itemData.get('value11').toBigInt();
    
    let condition = itemData.get('value12').toTuple();
    entity.requiredAKA = condition[0].toBigInt();
  } else {
    return;
  }
  
  entity.creator = event.transaction.from;
  entity.isSold = false;
  entity.blockTimestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.transactionHash = event.transaction.hash
  entity.save()
}

// export function processItem(value: JSONValue, userData: Value): void {
//   // See the JSONValue documentation for details on dealing
//   // with JSON values
//   let obj = value.toObject()
//   let image = obj.get('image').toString()
//   let name = obj.get('name').toString()
//   let description = obj.get('description').toString()


//   let entity = Item.load(userData.toString())
//   if(entity) {
//     entity.image = image
//     entity.name = name
//     entity.description = description
//     entity.save()
//   }
// }

export function handleBidAddedToItem(event: BidAddedToItem): void {
  let bidId = event.params.bidder.toHexString().concat(event.params.itemId.toString())
  let bidEntiry = Bid.load(bidId)

  if(!bidEntiry) {
    bidEntiry = new Bid(bidId)
    bidEntiry.itemId = event.params.itemId.toString()
    bidEntiry.bidder = event.params.bidder;
  }

  bidEntiry.amount = event.params.bidAmount
  bidEntiry.isActive = true
  bidEntiry.blockTimestamp = event.block.timestamp
  bidEntiry.blockNumber = event.block.number
  bidEntiry.transactionHash = event.transaction.hash

  bidEntiry.save()
}

export function handleAuctionCancelled(event: AuctionCancelled): void {
  let entity = Item.load(event.params.itemId.toString())

  if (entity != null) {
    entity.isSold = true;
    entity.count = BigInt.fromI32(0);

    entity.save()
  }
}

export function handleListCancelled(event: ListCancelled): void {
  let entity = Item.load(event.params.itemId.toString())

  if (entity != null) {
    entity.isSold = true;
    entity.count = BigInt.fromI32(0);

    entity.save()
  }
}

export function handleItemSold(event: ItemSold): void {
  let entity = Item.load(event.params.itemId.toString())

  if (entity != null) {
    entity.count = entity.count.minus(BigInt.fromI32(1))
    if(entity.count.isZero()) {
      entity.isSold = true;
    }

    entity.save()
  }
}

export function handleTransfer(event: TransferEvent): void {
  log.debug('Transfer detected. From: {} | To: {} | TokenID: {}', [
    event.params.from.toHexString(),
    event.params.to.toHexString(),
    event.params.tokenId.toHexString(),
  ]);

  let previousOwner = Owner.load(event.params.from.toHexString());
  let newOwner = Owner.load(event.params.to.toHexString());
  let token = Token.load(event.params.tokenId.toHexString());
  let transferId = event.transaction.hash
    .toHexString()
    .concat(':'.concat(event.transactionLogIndex.toHexString()));
  let transfer = Transfer.load(transferId);
  let contract = Contract.load(event.address.toHexString());
  let instance = pawNFT.bind(event.address);

  if (previousOwner == null) {
    previousOwner = new Owner(event.params.from.toHexString());
  }

  if (newOwner == null) {
    newOwner = new Owner(event.params.to.toHexString());
  }

  if (token == null) {
    token = new Token(event.params.tokenId.toHexString());
    token.owner = event.params.to.toHexString();
    token.contract = event.address.toHexString();

    let uri = instance.try_tokenURI(event.params.tokenId);
    if (!uri.reverted) {
      token.uri = uri.value;
    }
  }

  if (transfer == null) {
    transfer = new Transfer(transferId);
    transfer.token = event.params.tokenId.toHexString();
    transfer.from = event.params.from.toHexString();
    transfer.to = event.params.to.toHexString();
    transfer.timestamp = event.block.timestamp;
    transfer.block = event.block.number;
    transfer.transactionHash = event.transaction.hash.toHexString();
  }

  if (contract == null) {
    contract = new Contract(event.address.toHexString());
  }

  let name = instance.try_name();
  if (!name.reverted) {
    contract.name = name.value;
  }

  let symbol = instance.try_symbol();
  if (!symbol.reverted) {
    contract.symbol = symbol.value;
  }

  previousOwner.save();
  newOwner.save();
  token.save();
  contract.save();
  transfer.save();
}
