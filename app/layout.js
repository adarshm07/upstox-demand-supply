export const metadata = {
  title: "Meridian — SMC Trading Desk",
  description: "Indian market analysis with automatic Order Block, FVG & structure detection, powered by Upstox.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
