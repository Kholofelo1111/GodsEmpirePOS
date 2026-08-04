"use client";

import { use, useEffect, useState } from "react";
import ProductForm, { emptyProduct, type ProductFormValues } from "@/components/ProductForm";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { PackageX } from "lucide-react";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [initial, setInitial] = useState<ProductFormValues | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p) =>
        setInitial({
          ...emptyProduct,
          name: p.name ?? "",
          description: p.description ?? "",
          barcode: p.barcode ?? "",
          categoryId: p.categoryId ? String(p.categoryId) : "",
          imageUrl: p.imageUrl ?? "",
          costPrice: String(p.costPrice ?? ""),
          sellingPrice: String(p.sellingPrice ?? ""),
          stock: String(p.stock ?? 0),
          minStockLevel: String(p.minStockLevel ?? 5),
        })
      )
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="glass-card rounded-2xl max-w-lg mx-auto">
        <EmptyState
          icon={<PackageX className="w-6 h-6 text-dark-500" />}
          title="Product not found"
          message="It may have been removed from the catalogue."
        />
      </div>
    );
  }

  if (!initial) return <Spinner label="Loading product..." />;

  return (
    <ProductForm
      title="Edit Product"
      subtitle="Update pricing, stock and details"
      initial={initial}
      submitLabel="Update Product"
      endpoint={`/api/products/${id}`}
      method="PUT"
      productId={Number(id)}
    />
  );
}
