export const metadata = {
  title: "Explique pra mim",
  description: "Explique qualquer coisa de forma simples usando IA"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
