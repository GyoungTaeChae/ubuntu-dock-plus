# Compiles a .po file into a GNU .mo file, for machines without msgfmt.
# Handles what po/*.po use: msgid/msgstr with continued lines, no plurals
# or contexts. Usage: python3 tools/po2mo.py in.po out.mo
import ast
import struct
import sys


def entries(path):
    found, key, part = {}, None, None
    msg = {'msgid': '', 'msgstr': ''}
    for line in open(path, encoding='utf-8').read().splitlines() + ['']:
        line = line.strip()
        if line.startswith('msgid '):
            if part == 'msgstr':
                found[msg['msgid']] = msg['msgstr']
            part, msg = 'msgid', {'msgid': ast.literal_eval(line[6:]), 'msgstr': ''}
        elif line.startswith('msgstr '):
            part = 'msgstr'
            msg['msgstr'] = ast.literal_eval(line[7:])
        elif line.startswith('"') and part:
            msg[part] += ast.literal_eval(line)
    if part == 'msgstr':
        found[msg['msgid']] = msg['msgstr']
    return {k: v for k, v in found.items() if v}


def write(found, path):
    keys = sorted(found)
    ids = [k.encode() for k in keys]
    strs = [found[k].encode() for k in keys]
    n = len(keys)
    start = 7 * 4 + 16 * n
    offsets, data = [], b''
    for s in ids + strs:
        offsets.append((len(s), start + len(data)))
        data += s + b'\0'
    header = struct.pack('<7I', 0x950412de, 0, n, 28, 28 + 8 * n, 0, start)
    tables = b''.join(struct.pack('<2I', *o) for o in offsets[:n]) + b''.join(struct.pack('<2I', *o) for o in offsets[n:])
    open(path, 'wb').write(header + tables + data)


write(entries(sys.argv[1]), sys.argv[2])
