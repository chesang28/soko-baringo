const styles: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  reserved: "bg-yellow-100 text-yellow-800",
  sold_out: "bg-gray-200 text-gray-700",
  withdrawn: "bg-gray-200 text-gray-500",
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-indigo-100 text-indigo-800",
  confirmed: "bg-yellow-100 text-yellow-800",
  delivered: "bg-teal-100 text-teal-800",
  paid: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-gray-100"}`}>
      {status.replace("_", " ")}
    </span>
  );
}
