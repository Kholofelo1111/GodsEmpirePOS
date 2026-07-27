export default function Dashboard() {
  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-dark-900 p-5">
          <p className="text-dark-400">Today's Sales</p>
          <h2 className="text-2xl font-bold">R0.00</h2>
        </div>

        <div className="rounded-xl bg-dark-900 p-5">
          <p className="text-dark-400">Products</p>
          <h2 className="text-2xl font-bold">0</h2>
        </div>

        <div className="rounded-xl bg-dark-900 p-5">
          <p className="text-dark-400">Customers</p>
          <h2 className="text-2xl font-bold">0</h2>
        </div>

        <div className="rounded-xl bg-dark-900 p-5">
          <p className="text-dark-400">Low Stock</p>
          <h2 className="text-2xl font-bold">0</h2>
        </div>
      </div>
    </main>
  );
}
