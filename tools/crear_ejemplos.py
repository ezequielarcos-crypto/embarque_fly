#!/usr/bin/env python3
"""Genera las tarjetas .pkpass de ejemplo de la carpeta ejemplos/.

Son tarjetas de aerolíneas ficticias, sin firma, pensadas solo para probar la app.
Uso: python3 tools/crear_ejemplos.py  (requiere Pillow)
"""
import hashlib
import io
import json
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / 'ejemplos'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def png(img):
    buf = io.BytesIO()
    img.save(buf, 'PNG', optimize=True)
    return buf.getvalue()


def logo(text, color, mark):
    img = Image.new('RGBA', (320, 100), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 18, 64, 82), radius=16, fill=mark)
    d.polygon([(14, 64), (50, 50), (14, 36), (24, 50)], fill=color)
    d.text((80, 50), text, font=ImageFont.truetype(FONT, 40), fill=color, anchor='lm')
    return png(img)


def icon(mark):
    img = Image.new('RGBA', (58, 58), mark)
    d = ImageDraw.Draw(img)
    d.polygon([(12, 42), (48, 29), (12, 16), (22, 29)], fill='white')
    return png(img)


def strings_utf16(pairs):
    body = ''.join(f'"{k}" = "{v}";\n' for k, v in pairs.items())
    return '﻿'.encode('utf-16-le') + body.encode('utf-16-le')


def build(name, pass_json, files):
    files = {'pass.json': json.dumps(pass_json, ensure_ascii=False, indent=2).encode('utf-8'), **files}
    files['manifest.json'] = json.dumps({k: hashlib.sha1(v).hexdigest() for k, v in files.items()}, indent=2).encode()
    OUT.mkdir(exist_ok=True)
    with zipfile.ZipFile(OUT / name, 'w', zipfile.ZIP_DEFLATED) as z:
        for k, v in files.items():
            z.writestr(k, v)
    print('creado', OUT / name)


def boarding(org, serial, color, fg, label, dep, fields, barcode, **extra):
    return {
        'formatVersion': 1,
        'passTypeIdentifier': 'pass.demo.embarque',
        'serialNumber': serial,
        'teamIdentifier': 'DEMO000000',
        'organizationName': org,
        'description': 'Tarjeta de embarque',
        'backgroundColor': color,
        'foregroundColor': fg,
        'labelColor': label,
        'relevantDate': dep,
        'barcodes': [barcode],
        'boardingPass': {'transitType': 'PKTransitTypeAir', **fields},
        **extra,
    }


altamar_logo = logo('ALTAMAR', 'white', (255, 198, 41, 255))
altamar_icon = icon((16, 55, 107, 255))

build('altamar-mad-lim.pkpass', boarding(
    'Altamar Air (demo)', 'ALT-0731-12A', 'rgb(16,55,107)', 'rgb(255,255,255)', 'rgb(158,197,255)',
    '2026-11-14T23:55+01:00',
    {
        'headerFields': [{'key': 'gate', 'label': 'gate_label', 'value': 'J52', 'changeMessage': 'Nueva puerta: %@'}],
        'primaryFields': [
            {'key': 'origin', 'label': 'Madrid', 'value': 'MAD'},
            {'key': 'destination', 'label': 'Lima', 'value': 'LIM'},
        ],
        'secondaryFields': [
            {'key': 'passenger', 'label': 'passenger_label', 'value': 'LUCÍA FERNÁNDEZ'},
            {'key': 'class', 'label': 'class_label', 'value': 'Turista'},
        ],
        'auxiliaryFields': [
            {'key': 'flight', 'label': 'flight_label', 'value': 'AL0731'},
            {'key': 'departure', 'label': 'departure_label', 'value': '2026-11-14T23:55+01:00',
             'dateStyle': 'PKDateStyleShort', 'timeStyle': 'PKDateStyleShort'},
            {'key': 'boarding', 'label': 'boarding_label', 'value': '23:10'},
            {'key': 'seat', 'label': 'seat_label', 'value': '12A'},
        ],
        'backFields': [
            {'key': 'pnr', 'label': 'Localizador', 'value': 'QX7RTM'},
            {'key': 'terminal', 'label': 'Terminal', 'value': 'T4S'},
            {'key': 'bags', 'label': 'Equipaje', 'value': '1 maleta de 23 kg facturada'},
            {'key': 'info', 'label': 'Información', 'value': 'Tarjeta de demostración generada por Embarque.\nMás info: https://example.com/embarque'},
        ],
    },
    {'format': 'PKBarcodeFormatPDF417', 'message': 'M1FERNANDEZ/LUCIA     EQX7RTM MADLIMAL 0731 318Y012A0042 100',
     'messageEncoding': 'iso-8859-1', 'altText': 'QX7RTM'},
), {
    'logo@2x.png': altamar_logo,
    'icon@2x.png': altamar_icon,
    'es.lproj/pass.strings': strings_utf16({
        'gate_label': 'PUERTA', 'passenger_label': 'PASAJERO', 'class_label': 'CLASE', 'flight_label': 'VUELO',
        'departure_label': 'SALIDA', 'boarding_label': 'EMBARQUE', 'seat_label': 'ASIENTO',
    }),
    'en.lproj/pass.strings': strings_utf16({
        'gate_label': 'GATE', 'passenger_label': 'PASSENGER', 'class_label': 'CLASS', 'flight_label': 'FLIGHT',
        'departure_label': 'DEPARTS', 'boarding_label': 'BOARDING', 'seat_label': 'SEAT',
    }),
})

build('altamar-lim-cuz.pkpass', boarding(
    'Altamar Air (demo)', 'ALT-2210-03C', 'rgb(16,55,107)', 'rgb(255,255,255)', 'rgb(158,197,255)',
    '2026-11-20T07:40-05:00',
    {
        'headerFields': [{'key': 'gate', 'label': 'PUERTA', 'value': '18'}],
        'primaryFields': [
            {'key': 'origin', 'label': 'Lima', 'value': 'LIM'},
            {'key': 'destination', 'label': 'Cusco', 'value': 'CUZ'},
        ],
        'secondaryFields': [{'key': 'passenger', 'label': 'PASAJERO', 'value': 'LUCÍA FERNÁNDEZ'}],
        'auxiliaryFields': [
            {'key': 'flight', 'label': 'VUELO', 'value': 'AL2210'},
            {'key': 'departure', 'label': 'SALIDA', 'value': '2026-11-20T07:40-05:00',
             'dateStyle': 'PKDateStyleShort', 'timeStyle': 'PKDateStyleShort'},
            {'key': 'seat', 'label': 'ASIENTO', 'value': '3C'},
            {'key': 'zone', 'label': 'GRUPO', 'value': '1'},
        ],
        'backFields': [{'key': 'pnr', 'label': 'Localizador', 'value': 'QX7RTM'}],
    },
    {'format': 'PKBarcodeFormatQR', 'message': 'M1FERNANDEZ/LUCIA     EQX7RTM LIMCUZAL 2210 324Y003C0007 100',
     'messageEncoding': 'iso-8859-1'},
    voided=True,
), {'logo@2x.png': altamar_logo, 'icon@2x.png': altamar_icon})

build('nimbo-bcn-ory.pkpass', boarding(
    'Nimbo Airways (demo)', 'NMB-4412-21F', 'rgb(250,248,242)', 'rgb(24,26,30)', 'rgb(196,72,48)',
    '2026-09-02T09:15+02:00',
    {
        'headerFields': [{'key': 'date', 'label': 'FECHA', 'value': '2026-09-02T09:15+02:00', 'dateStyle': 'PKDateStyleShort'}],
        'primaryFields': [
            {'key': 'origin', 'label': 'Barcelona', 'value': 'BCN'},
            {'key': 'destination', 'label': 'París Orly', 'value': 'ORY'},
        ],
        'secondaryFields': [
            {'key': 'passenger', 'label': 'PASAJERO', 'value': 'LUCÍA FERNÁNDEZ'},
            {'key': 'flight', 'label': 'VUELO', 'value': 'NB4412'},
        ],
        'auxiliaryFields': [
            {'key': 'boarding', 'label': 'EMBARQUE', 'value': '08:35'},
            {'key': 'gate', 'label': 'PUERTA', 'value': 'B31'},
            {'key': 'seat', 'label': 'ASIENTO', 'value': '21F'},
        ],
        'backFields': [{'key': 'pnr', 'label': 'Código de reserva', 'value': 'NB82KD'}],
    },
    {'format': 'PKBarcodeFormatAztec', 'message': 'M1FERNANDEZ/LUCIA     ENB82KD BCNORYNB 4412 245Y021F0031 100',
     'messageEncoding': 'iso-8859-1'},
), {
    'logo@2x.png': logo('NIMBO', (24, 26, 30, 255), (196, 72, 48, 255)),
    'icon@2x.png': icon((196, 72, 48, 255)),
})
