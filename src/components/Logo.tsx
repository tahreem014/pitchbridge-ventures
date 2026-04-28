import { Link } from "react-router-dom";

export const Logo = ({ variant = "default" }: { variant?: "default" | "light" }) => {
  const textColor = variant === "light" ? "text-white" : "text-foreground";
  return (
    <Link to="/" className="flex items-center gap-2 group">
      <div className="relative h-9 w-9 rounded-xl bg-gradient-accent shadow-glow flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-60" />
        <svg viewBox="0 0 24 24" className="relative h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M14 7h7v7" />
        </svg>
      </div>
      <span className={`font-display font-bold text-lg tracking-tight ${textColor}`}>
        Pitch<span className="gradient-text">Bridge</span>
      </span>
    </Link>
  );
};
