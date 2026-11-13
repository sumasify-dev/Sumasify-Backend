import { toInternationalFormat } from "../../middleware/utils/phoneNumber.js";
import {
  findAddressesByUserId,
  createAddressForUser,
} from "./address.model.js";

function toAddressDto(address) {
  return {
    id: address.id,
    label: address.label,
    recipientname: address.recipientName,
    phone: address.phone,
    areacode: address.areaCode,
    addressline: address.addressLine,
    instructions: address.instructions,
    isdefault: address.isDefault,
    createdat: address.createdAt,
    updatedat: address.updatedAt,
  };
}

export async function listBuyerAddresses(userId) {
  const addresses = await findAddressesByUserId(userId);

  return addresses.map(toAddressDto);
}

export async function createBuyerAddress({ userId, data }) {
  const address = await createAddressForUser({
    userId,
    data: {
      ...data,
      phone: toInternationalFormat(data.phone),
    },
  });

  return toAddressDto(address);
}