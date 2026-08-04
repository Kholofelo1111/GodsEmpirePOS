"use client";

import { useEffect, useState } from "react";

export type Product = {
  id: number;
  name: string;
  sellingPrice: string;
  stock: number;
};

type Props = {
  onSelect: (product: Product) => void;
};

export default function ProductPicker({ onSelect }: Props) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts)
      .catch(console.error);
  }, []);

  return (
    <div className="rounded-lg border p-4">

      <h3 className="font-semibold mb-4">
        Select Product
      </h3>

      <div className="space-y-2 max-h-80 overflow-y-auto">

        {products.map((p) => (

          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="w-full rounded-lg border p-3 text-left hover:bg-gray-50"
          >

            <div className="font-medium">
              {p.name}
            </div>

            <div className="text-sm text-gray-500">
              Stock: {p.stock} • R{p.sellingPrice}
            </div>

          </button>

        ))}

      </div>

    </div>
  );
}
