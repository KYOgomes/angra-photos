import { useEffect, useState } from "react";
import { Waves } from "lucide-react";
import { Album } from "@/components/Album";
import { TelaLogin } from "@/components/TelaLogin";
import { api } from "@/lib/api";

type Estado = "verificando" | "login" | "dentro";

export default function App() {
  const [estado, setEstado] = useState<Estado>("verificando");

  useEffect(() => {
    api
      .sessao()
      .then(() => setEstado("dentro"))
      .catch(() => setEstado("login"));
    const expirou = () => setEstado("login");
    window.addEventListener("sessao-expirada", expirou);
    return () => window.removeEventListener("sessao-expirada", expirou);
  }, []);

  if (estado === "verificando") {
    return (
      <div className="grid h-dvh place-items-center bg-ocean-deep">
        <Waves className="size-10 animate-pulse text-aqua" />
      </div>
    );
  }
  if (estado === "login") return <TelaLogin onEntrar={() => setEstado("dentro")} />;
  return <Album onSair={() => setEstado("login")} />;
}
