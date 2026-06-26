export const metadata = {
  title: "Red's Tunershop",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <head>
        <script src="https://unpkg.com/tesseract.js@v4.0.2/dist/tesseract.min.js"></script>
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}