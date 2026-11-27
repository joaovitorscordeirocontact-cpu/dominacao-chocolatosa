#!/usr/bin/env python3
"""
Gera os assets da aplicação a partir dos originais em image-assets/.

Os originais nunca são alterados. Saída em public/assets/.
Requisito: Python 3 + Pillow  (pip install Pillow)
Uso: npm run assets
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

RAIZ = Path(__file__).resolve().parent.parent
ORIGEM = RAIZ / "image-assets"
SAIDA = RAIZ / "public" / "assets"

# A transparência dos originais é real, mas "suja": há resíduo colorido
# (vermelho/amarelo) em pixels quase invisíveis (alfa 1-24) e as áreas
# sólidas ficam em 240-254. Normalizamos as duas pontas.
ALFA_MIN, ALFA_MAX = 24, 244

# Caixas (x0, y0, x1, y1) de cada elemento, usadas só para IDENTIFICAR o
# componente conectado correspondente; o recorte usa os pixels do componente.
PERSONAGEM = {
    "corpo": (22, 194, 512, 762),
    "coroa": (531, 98, 760, 269),
    "chapeu-chef": (778, 78, 1009, 268),
    "bone": (1029, 113, 1247, 270),
    "cartola": (1268, 89, 1510, 281),
    "aureola": (1534, 153, 1732, 239),
    "cabelo-longo": (512, 330, 778, 580),
    "topete-loiro": (779, 339, 1002, 496),
    "bigode": (1035, 423, 1231, 486),
    "oculos-redondos": (1262, 390, 1500, 490),
    "oculos-escuros": (1522, 403, 1757, 490),
    "laco": (528, 643, 759, 818),
    "monoculo": (796, 624, 940, 817),
    "barba": (985, 647, 1215, 830),
    "gravata": (1246, 659, 1442, 770),
    "capa": (1452, 598, 1769, 826),
}

FABRICAS = {
    "engrenagem": (13, 28, 354, 408),
    "castelo": (369, 21, 704, 404),
    "palacio-dourado": (722, 66, 1067, 404),
    "rosquinha": (1083, 59, 1407, 407),
    "chale": (1436, 70, 1764, 407),
    "cupula": (14, 499, 373, 842),
    "torre-torta": (398, 443, 650, 845),
    "realeza": (674, 503, 1062, 843),
    "cogumelo": (1069, 493, 1391, 842),
    "relogio": (1414, 503, 1766, 842),
}

CORES_CORPO = {
    "azul": (74, 143, 232),
    "verde": (76, 188, 108),
    "rosa": (244, 122, 170),
    "chocolate": (104, 56, 36),
    "branco": None,  # original
    "marrom": (178, 112, 62),
}

# Regiões do rosto (coordenadas da folha) cujos traços não são recoloridos.
ROSTO = [(176, 328, 226, 380), (319, 328, 369, 380), (224, 362, 322, 414)]

PADDING = 4


def limpar_alfa(img):
    escala = 255 / (ALFA_MAX - ALFA_MIN)
    tabela = [0 if a <= ALFA_MIN else min(255, round((a - ALFA_MIN) * escala)) for a in range(256)]
    img = img.convert("RGBA")
    img.putalpha(img.getchannel("A").point(tabela))
    return img


def componentes(img):
    """Componentes conectados (alfa >= 128) -> lista de (bbox, pixels)."""
    w, h = img.size
    dados = img.getchannel("A").tobytes()
    visto = bytearray(w * h)
    achados = []
    for inicio in range(w * h):
        if visto[inicio] or dados[inicio] < 128:
            continue
        visto[inicio] = 1
        pilha, pixels = [inicio], []
        while pilha:
            p = pilha.pop()
            pixels.append(p)
            x = p % w
            for q in (p - 1 if x else -1, p + 1 if x < w - 1 else -1, p - w, p + w):
                if 0 <= q < w * h and not visto[q] and dados[q] >= 128:
                    visto[q] = 1
                    pilha.append(q)
        if len(pixels) > 40:
            xs = [p % w for p in pixels]
            ys = [p // w for p in pixels]
            achados.append(((min(xs), min(ys), max(xs) + 1, max(ys) + 1), pixels))
    return achados


def isolar(folha, comps, caixa_esperada):
    """Recorta um único componente, sem vazar partes dos vizinhos."""
    def distancia(c):
        return sum(abs(a - b) for a, b in zip(c[0], caixa_esperada))

    comp = min(comps, key=distancia)
    if distancia(comp) > 24:
        raise SystemExit(f"Componente não encontrado perto de {caixa_esperada}; a folha mudou?")
    bbox, pixels = comp
    w, h = folha.size
    buffer = bytearray(w * h)
    for p in pixels:
        buffer[p] = 255
    # Dilata para preservar a borda suavizada (anti-aliasing) do próprio item.
    caixa = (bbox[0] - PADDING, bbox[1] - PADDING, bbox[2] + PADDING, bbox[3] + PADDING)
    mascara = Image.frombytes("L", (w, h), bytes(buffer)).crop(caixa).filter(ImageFilter.MaxFilter(7))
    item = folha.crop(caixa)
    item.putalpha(ImageChops.multiply(item.getchannel("A"), mascara.point(lambda v: 255 if v else 0)))
    return item, caixa


def luma(rgb):
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]


def peso_dos_tracos(img, caixa):
    """
    Para cada pixel do rosto, quanto dele é "traço" (olho/boca): 0 = pele, 1 = traço.
    Retorna {(x, y): (peso, rgb_da_pele_local)}.
    """
    pesos = {}
    px = img.load()
    for rx0, ry0, rx1, ry1 in ROSTO:
        x0, y0, x1, y1 = rx0 - caixa[0], ry0 - caixa[1], rx1 - caixa[0], ry1 - caixa[1]
        borda = [px[x, y][:3] for x in range(x0, x1) for y in (y0, y1 - 1)]
        borda += [px[x, y][:3] for y in range(y0, y1) for x in (x0, x1 - 1)]
        borda.sort(key=luma)
        pele = borda[len(borda) // 2]
        luma_pele, luma_traco = luma(pele), 40
        local = {}
        for y in range(y0, y1):
            for x in range(x0, x1):
                t = (luma_pele - luma(px[x, y]) - 14) / (luma_pele - luma_traco - 14)
                local[(x, y)] = max(0.0, min(1.0, t))
        # Pontos de brilho dentro dos olhos: claros, porém cercados pelo traço.
        fora = set()
        pilha = [(x, y) for (x, y) in local if x in (x0, x1 - 1) or y in (y0, y1 - 1)]
        while pilha:
            x, y = pilha.pop()
            if (x, y) in fora or (x, y) not in local or local[(x, y)] >= 0.5:
                continue
            fora.add((x, y))
            pilha += [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]
        for chave, t in local.items():
            if chave not in fora and t < 0.5:
                t = 1.0
            pesos[chave] = (t, pele)
    return pesos


def recolorir_corpo(corpo, caixa, cor):
    """Mapeia a luminosidade do corpo branco para a nova cor, preservando volume."""
    lumas = sorted(luma(p) for p in corpo.get_flattened_data() if p[3] == 255)
    referencia = lumas[int(len(lumas) * 0.80)]
    tracos = peso_dos_tracos(corpo, caixa)

    def tingir(rgb):
        r = luma(rgb) / referencia
        if r <= 1:
            return tuple(c * (r ** 1.45) for c in cor)
        brilho = min(1.0, (r - 1) * 3.2)
        return tuple(c + (255 - c) * brilho * 0.55 for c in cor)

    saida = corpo.copy()
    origem, destino = corpo.load(), saida.load()
    for y in range(corpo.height):
        for x in range(corpo.width):
            *rgb, a = origem[x, y]
            if a == 0:
                continue
            t, pele = tracos.get((x, y), (0.0, None))
            if t <= 0:
                novo = tingir(rgb)
            else:
                # Mantém o traço original e troca apenas a fração que era pele.
                pele_nova = tingir(pele)
                novo = tuple(o - (1 - t) * (v - n) for o, v, n in zip(rgb, pele, pele_nova))
            destino[x, y] = tuple(max(0, min(255, round(v))) for v in novo) + (a,)
    return saida


def salvar(img, caminho, qualidade=92):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    img.save(caminho, "WEBP", quality=qualidade, alpha_quality=100, method=6)


def peca_da_abertura(home, poligono, suavizar=10):
    mascara = Image.new("L", home.size, 0)
    ImageDraw.Draw(mascara).polygon(poligono, fill=255)
    # O desfoque é aplicado numa tela ampliada para não esmaecer as bordas externas.
    margem = suavizar * 3
    ampliada = Image.new("L", (home.width + 2 * margem, home.height + 2 * margem), 0)
    deslocado = [
        (x + margem + (-margem if x <= 0 else margem if x >= home.width else 0),
         y + margem + (-margem if y <= 0 else margem if y >= home.height else 0))
        for x, y in poligono
    ]
    ImageDraw.Draw(ampliada).polygon(deslocado, fill=255)
    mascara = ampliada.filter(ImageFilter.GaussianBlur(suavizar)).crop(
        (margem, margem, margem + home.width, margem + home.height))
    peca = home.convert("RGBA")
    peca.putalpha(mascara)
    xs = [x for x, _ in poligono]
    ys = [y for _, y in poligono]
    folga = suavizar * 2
    return peca.crop((max(0, min(xs) - folga), max(0, min(ys) - folga),
                      min(home.width, max(xs) + folga), min(home.height, max(ys) + folga)))


def main():
    folha = limpar_alfa(Image.open(ORIGEM / "bonneco-referencia.PNG"))
    comps = componentes(folha)
    for nome, esperada in PERSONAGEM.items():
        item, caixa = isolar(folha, comps, esperada)
        if nome == "corpo":
            for cor_nome, cor in CORES_CORPO.items():
                variante = item if cor is None else recolorir_corpo(item, caixa, cor)
                salvar(variante, SAIDA / "personagem" / f"corpo-{cor_nome}.webp")
        else:
            salvar(item, SAIDA / "personagem" / f"{nome}.webp")
        print(f"personagem/{nome}: {item.size}")

    folha = limpar_alfa(Image.open(ORIGEM / "fabricas-icones.png"))
    comps = componentes(folha)
    for nome, esperada in FABRICAS.items():
        item, _ = isolar(folha, comps, esperada)
        salvar(item, SAIDA / "fabricas" / f"{nome}.webp")
        print(f"fabricas/{nome}: {item.size}")

    # Abertura: só regiões SEM texto. Título, "Atmosfera Jovem" e botão são HTML.
    home = Image.open(ORIGEM / "tela-home.PNG").convert("RGB")
    pecas = {
        "topo": [(0, 0), (1672, 0), (1672, 250), (1520, 205), (1410, 110), (1250, 56),
                 (420, 56), (300, 105), (170, 195), (0, 250)],
        "lado-esquerdo": [(0, 235), (235, 225), (248, 500), (385, 535), (385, 585),
                          (470, 612), (470, 755), (540, 790), (540, 941), (0, 941)],
        "lado-direito": [(1672, 235), (1445, 225), (1434, 500), (1302, 535), (1302, 585),
                         (1192, 612), (1192, 755), (1122, 790), (1122, 941), (1672, 941)],
        "base-centro": [(440, 800), (1230, 790), (1230, 941), (440, 941)],
    }
    for nome, poligono in pecas.items():
        peca = peca_da_abertura(home, poligono)
        salvar(peca, SAIDA / "abertura" / f"{nome}.webp", qualidade=88)
        xs = [x for x, _ in poligono]
        ys = [y for _, y in poligono]
        caixa = (max(0, min(xs) - 20), max(0, min(ys) - 20),
                 min(home.width, max(xs) + 20), min(home.height, max(ys) + 20))
        print(f"abertura/{nome}: caixa na referência {caixa}")


if __name__ == "__main__":
    main()
