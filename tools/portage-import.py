#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de extracao/validacao do Inventario Portage Operacionalizado (IPO)
a partir da planilha original PORTAGE-PEI_COMPLETO.xlsx.

Mantido apenas como referencia de auditoria: documenta como data/portage/inventario.json
foi originalmente gerado a partir da planilha. Nao roda como parte do build ou da aplicacao
em producao — nenhuma tela ou modulo do PTS importa ou executa este arquivo.

Caso a planilha original seja atualizada no futuro, este script pode servir de ponto de
partida para regenerar o inventario.json, mas exige revisao manual do resultado antes de
substituir o arquivo em producao.
"""

import json
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("Este script requer openpyxl: pip install openpyxl", file=sys.stderr)
    sys.exit(1)

ARQUIVO_ORIGEM = "PORTAGE-PEI_COMPLETO.xlsx"
ABA_DADOS = "AV 1"

AREAS = [
    {"id": "socializacao", "nome": "Socialização", "prefixo": "SOC", "ordem": 1},
    {"id": "linguagem", "nome": "Linguagem", "prefixo": "LIN", "ordem": 2},
    {"id": "cognicao", "nome": "Cognição", "prefixo": "COG", "ordem": 3},
    {"id": "autocuidados", "nome": "Autocuidados", "prefixo": "AUT", "ordem": 4},
    {"id": "motor", "nome": "Desenvolvimento Motor", "prefixo": "MOT", "ordem": 5},
]

FAIXAS = [
    {"id": "0-1", "rotulo": "0 a 1 ano", "inicioMeses": 0, "fimMeses": 12},
    {"id": "1-2", "rotulo": "1 a 2 anos", "inicioMeses": 12, "fimMeses": 24},
    {"id": "2-3", "rotulo": "2 a 3 anos", "inicioMeses": 24, "fimMeses": 36},
    {"id": "3-4", "rotulo": "3 a 4 anos", "inicioMeses": 36, "fimMeses": 48},
    {"id": "4-5", "rotulo": "4 a 5 anos", "inicioMeses": 48, "fimMeses": 60},
    {"id": "5-6", "rotulo": "5 a 6 anos", "inicioMeses": 60, "fimMeses": 72},
]

ESCALA = [
    {"valor": "adquirido", "rotulo": "Sim", "pontos": 1},
    {"valor": "emergente", "rotulo": "Às vezes", "pontos": 0.5},
    {"valor": "nao_adquirido", "rotulo": "Não", "pontos": 0},
    {"valor": "nao_avaliado", "rotulo": "NA", "pontos": None},
]


def extrair_itens(caminho_planilha):
    """Lê a aba de dados e retorna a lista de itens {id, area, faixa, numero, ordem, titulo}.

    Formato esperado das colunas da planilha original: Área | Faixa Etária | Número | Item.
    A ordem dentro de cada (área, faixa) é a ordem de leitura das linhas.
    """
    wb = openpyxl.load_workbook(caminho_planilha, data_only=True)
    ws = wb[ABA_DADOS]

    itens = []
    contadores_ordem = {}

    for linha in ws.iter_rows(min_row=2, values_only=True):
        area_nome, faixa_id, numero, titulo = linha[:4]
        if not area_nome or not titulo:
            continue

        area = next((a for a in AREAS if a["nome"] == area_nome), None)
        if area is None:
            print(f"Aviso: área desconhecida '{area_nome}' ignorada.", file=sys.stderr)
            continue

        chave_ordem = (area["id"], faixa_id)
        contadores_ordem[chave_ordem] = contadores_ordem.get(chave_ordem, 0) + 1
        ordem = contadores_ordem[chave_ordem]

        item_id = f"{area['prefixo']}-{int(numero):03d}"
        itens.append({
            "id": item_id,
            "area": area["id"],
            "faixa": faixa_id,
            "numero": int(numero),
            "ordem": ordem,
            "titulo": str(titulo).strip(),
        })

    return itens


def montar_metadados(itens):
    """Calcula totalItens e itensPorFaixa por área a partir da lista de itens extraída."""
    areas_saida = []
    for area in AREAS:
        itens_area = [i for i in itens if i["area"] == area["id"]]
        itens_por_faixa = {}
        for faixa in FAIXAS:
            itens_por_faixa[faixa["id"]] = sum(1 for i in itens_area if i["faixa"] == faixa["id"])
        areas_saida.append({
            **area,
            "totalItens": len(itens_area),
            "itensPorFaixa": itens_por_faixa,
        })
    return areas_saida


def validar(itens, areas):
    """Validações básicas de integridade antes de gerar o inventario.json."""
    erros = []

    ids = [i["id"] for i in itens]
    duplicados = {x for x in ids if ids.count(x) > 1}
    if duplicados:
        erros.append(f"IDs duplicados: {sorted(duplicados)}")

    for area in areas:
        if area["totalItens"] == 0:
            erros.append(f"Área '{area['id']}' sem nenhum item extraído.")

    faixas_validas = {f["id"] for f in FAIXAS}
    for item in itens:
        if item["faixa"] not in faixas_validas:
            erros.append(f"Item {item['id']} com faixa inválida: {item['faixa']}")

    if erros:
        print("Erros de validação encontrados:", file=sys.stderr)
        for e in erros:
            print(f"  - {e}", file=sys.stderr)
        return False

    return True


def main():
    caminho_planilha = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(ARQUIVO_ORIGEM)
    if not caminho_planilha.exists():
        print(f"Planilha não encontrada: {caminho_planilha}", file=sys.stderr)
        sys.exit(1)

    itens = extrair_itens(caminho_planilha)
    areas = montar_metadados(itens)

    if not validar(itens, areas):
        print("\nValidação falhou. Corrija a planilha ou o script antes de gerar o inventário.", file=sys.stderr)
        sys.exit(1)

    inventario = {
        "instrumento": "Guia Portage de Educação Pré-Escolar / IPO",
        "referencia": "Bluma, Shearer, Frohman & Hilliard (1976); operacionalização br.: Williams & Aiello (2001/2018)",
        "origemDados": f"{caminho_planilha.name}, aba \"{ABA_DADOS}\"",
        "escopo": "5 áreas, 0-6 anos. NÃO inclui a área Estimulação Infantil (0-4 meses, 45 itens) do IPO completo.",
        "escala": ESCALA,
        "faixas": FAIXAS,
        "areas": areas,
        "itens": itens,
    }

    saida = Path("inventario.json")
    with saida.open("w", encoding="utf-8") as f:
        json.dump(inventario, f, ensure_ascii=False, indent=1)

    total = len(itens)
    print(f"OK: {total} itens extraídos em {len(areas)} áreas -> {saida}")
    for area in areas:
        print(f"  {area['nome']}: {area['totalItens']} itens")


if __name__ == "__main__":
    main()
