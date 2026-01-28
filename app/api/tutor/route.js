import "./globals.css";

export const metadata = {
  title: "AI Tutor (Teach-Not-Solve)",
  description: "School-safe AI tutoring with Session Mode and learning supports."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
