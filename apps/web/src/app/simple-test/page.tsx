export default function SimpleTestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Simple Test Page</h1>
      <p>This page works if you can see this text.</p>
      <a href="/new-dashboard" className="text-blue-600 underline">
        Try Dashboard Link
      </a>
    </div>
  );
}