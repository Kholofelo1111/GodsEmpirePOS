import { Product } from "@/components/invoices/ProductPicker";
import { Dispatch, SetStateAction } from "react";

export type InvoiceItem = Product & {
  quantity: number;
};

export interface InvoiceTotals {
  subtotal: number;
  vat: number;
  discount: number;
  total: number;
}

export interface InvoiceItemsTableProps {
  items: InvoiceItem[];
  setItems: Dispatch<SetStateAction<InvoiceItem[]>>;

  discount: number;
  setDiscount: Dispatch<SetStateAction<number>>;

  vatEnabled: boolean;
  setVatEnabled: Dispatch<SetStateAction<boolean>>;
}
