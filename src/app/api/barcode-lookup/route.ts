import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get("barcode");

  if (!barcode) {
    return NextResponse.json(
      { error: "Barcode is required" },
      { status: 400 }
    );
  }

  try {
    // OpenFoodFacts (free product database)
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
      {
        headers: {
          "User-Agent": "GodsEmpirePOS/1.0"
        },
        cache: "no-store"
      }
    );

    if (!res.ok) {
      throw new Error("Lookup failed");
    }

    const data = await res.json();

    if (!data.product) {
      return NextResponse.json({ found: false });
    }

    const product = data.product;

    return NextResponse.json({
      found: true,
      barcode,
      name: product.product_name ?? "",
      brand: product.brands ?? "",
      quantity: product.quantity ?? "",
      image: product.image_front_url ?? "",
      category: product.categories ?? ""
    });
  } catch {
    return NextResponse.json({ found: false });
  }
}
