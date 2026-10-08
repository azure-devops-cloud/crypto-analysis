import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Crypto Analysis", description: "Free BTC, ETH and SOL technical-analysis dashboard" };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}