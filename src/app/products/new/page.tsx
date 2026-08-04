"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProductForm, { emptyProduct } from "@/components/ProductForm";
import Spinner from "@/components/ui/Spinner";

function NewProductForm() {
  const params = useSearchParams();
  const barcode = params.get("barcode") ?? "";
  const returnParam = params.get("return") ?? "";
  const returnPath = returnParam.startsWith("/") ? returnParam : returnParam ? `/${returnParam}` : "";

  return (
    <ProductForm
      title="Add Product"
      subtitle={
        barcode
          ? `Creating product for barcode ${barcode}. Will return to previous workflow automatically.`
          : "Create a new catalogue item"
      }
      initial={{ ...emptyProduct, barcode }}
      submitLabel="Save Product"
      endpoint="/api/products"
      method="POST"
      returnPath={returnPath}
    />
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewProductForm />
    </Suspense>
  );
}
