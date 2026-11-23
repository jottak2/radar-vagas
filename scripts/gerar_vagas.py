#!/usr/bin/env python3
"""
Gera data/vagas.js a partir da leitura da planilha de vagas (Claude Sheets).

Uso:
    python3 scripts/gerar_vagas.py leitura.json [data/vagas.js]

`leitura.json` é o resultado de um `readCells` da aba "Vagas" (A1:I...),
com o objeto "rows" (linhas numeradas) dentro de "value" ou na raiz.
A primeira linha é o cabeçalho:
Vaga | Empresa | Local e modalidade | Aderência | Status | Link | Observações | Tipo | Publicada em
"""
import json
import re
import sys
from datetime import datetime, timezone, timedelta

PLANILHA_URL = "https://docs.google.com/spreadsheets/d/1C_Mjtp4QYcBdvr-OTHzpqU_Hpg6cFzUQfDLW3L6mz4E/edit"
TZ_SP = timezone(timedelta(hours=-3))


def texto(cell):
    if cell is None:
        return ""
    if isinstance(cell, dict):
        if "markdown" in cell:
            return re.sub(r"\[([^\]]*)\]\(([^)]*)\)", r"\1", cell["markdown"]).strip()
        if "date" in cell:
            return cell["date"]
        if "value" in cell:
            return texto(cell["value"])
        if "shown" in cell:
            return str(cell["shown"])
        return ""
    return str(cell).strip()


def link(cell):
    if isinstance(cell, dict) and "markdown" in cell:
        m = re.search(r"\((https?://[^)\s]+)\)", cell["markdown"])
        return m.group(1) if m else ""
    s = texto(cell)
    return s if s.startswith("http") else ""


def data_iso(cell):
    if isinstance(cell, dict):
        if "date" in cell:
            return cell["date"]
        if "dateTime" in cell:
            return cell["dateTime"][:10]
        if "value" in cell:
            return data_iso(cell["value"])
    s = texto(cell)
    m = re.match(r"(\d{4}-\d{2}-\d{2})", s)
    if m:
        return m.group(1)
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", s)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return None


def main():
    origem = sys.argv[1]
    destino = sys.argv[2] if len(sys.argv) > 2 else "data/vagas.js"
    with open(origem, encoding="utf-8") as f:
        bruto = json.load(f)
    rows = bruto.get("value", bruto).get("rows", bruto.get("rows"))
    if rows is None:
        raise SystemExit("Não achei 'rows' na leitura da planilha.")

    numeros = sorted(int(k) for k in rows.keys())
    vagas = []
    for n in numeros:
        if n == 1:
            continue  # cabeçalho
        r = list(rows[str(n)]) + [None] * 9
        titulo = texto(r[0])
        if not titulo:
            continue
        vagas.append({
            "vaga": titulo,
            "empresa": texto(r[1]),
            "local": texto(r[2]),
            "aderencia": texto(r[3]) or "Média",
            "status": texto(r[4]) or "A candidatar",
            "link": link(r[5]),
            "obs": texto(r[6]),
            "tipo": texto(r[7]),
            "publicada": data_iso(r[8]),
        })

    agora = datetime.now(TZ_SP).strftime("%Y-%m-%dT%H:%M:%S-03:00")
    dados = {"atualizadoEm": agora, "planilhaUrl": PLANILHA_URL, "vagas": vagas}
    with open(destino, "w", encoding="utf-8") as f:
        f.write("/* Gerado automaticamente por scripts/gerar_vagas.py. Não edite à mão. */\n")
        f.write("window.VAGAS_DATA = ")
        json.dump(dados, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    print(f"{len(vagas)} vagas gravadas em {destino} ({agora})")


if __name__ == "__main__":
    main()
