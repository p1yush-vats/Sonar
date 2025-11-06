import { useState } from "react";
import { Menu, X, Radio } from "lucide-react";
import PageRouter from "../pages/PageRouter";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState("home");

  const navLinks = [
    { id: "home", label: "Home" },
    { id: "how-it-works", label: "How It Works" },
    { id: "recognize", label: "Try" }
  ];

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-black/40 backdrop-blur-xl border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center h-16">
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Radio className="w-6 h-6 text-cyan-400" />
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">
              SONAR
            </span>
          </div>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => setPage(link.id)}
                className={`transition-all ${
                  page === link.id
                    ? "text-cyan-400 drop-shadow-[0_0_6px_#22d3ee]"
                    : "text-gray-400 hover:text-cyan-300"
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Mobile */}
          <button onClick={() => setOpen(!open)} className="md:hidden text-cyan-400">
            {open ? <X /> : <Menu />}
          </button>
        </div>

        {open && (
          <div className="md:hidden bg-black/80 border-b border-cyan-700/20">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => {
                  setPage(link.id);
                  setOpen(false);
                }}
                className="block w-full text-left px-6 py-3 text-gray-300 hover:text-cyan-300"
              >
                {link.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      <PageRouter currentPage={page} />
    </>
  );
}
