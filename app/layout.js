import { Inter, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });

export const metadata = {
  title: "Taramind — Veille augmentée",
  description: "Second cerveau de veille technologique : capter, qualifier, ranger, republier.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} ${hanken.variable}`}>
        {children}
      </body>
    </html>
  );
}