#!/usr/bin/env python3
"""Valida formato/arquitetura de um binário sem executá-lo.

Uso: check_binary.py <goos> <goarch> <arquivo>
"""
import os
import struct
import sys


def fail(msg):
    print(f"ERRO: {msg}", file=sys.stderr)
    sys.exit(1)


def check_elf(data, goos, goarch):
    if data[4] != 2 or data[5] != 1:
        fail("ELF precisa ser 64-bit little-endian")
    machine = struct.unpack_from("<H", data, 18)[0]
    want = {"amd64": 62, "arm64": 183}[goarch]
    if machine != want:
        fail(f"e_machine={machine}, esperado {want} ({goarch})")
    phoff = struct.unpack_from("<Q", data, 32)[0]
    phentsize, phnum = struct.unpack_from("<HH", data, 54)
    interp = None
    for i in range(phnum):
        off = phoff + i * phentsize
        if struct.unpack_from("<I", data, off)[0] == 3:  # PT_INTERP
            p_offset = struct.unpack_from("<Q", data, off + 8)[0]
            p_filesz = struct.unpack_from("<Q", data, off + 32)[0]
            interp = data[p_offset:p_offset + p_filesz].split(b"\0")[0].decode()
    if goos == "android":
        if interp != "/system/bin/linker64":
            fail(f"binário Android deve usar /system/bin/linker64, interpretador: {interp!r}")
    elif interp is not None:
        fail(f"binário Linux deveria ser estático, interpretador: {interp!r}")


def check_macho(data, goarch):
    if data[:4] != b"\xcf\xfa\xed\xfe":
        fail("não é Mach-O 64-bit")
    cpu = struct.unpack_from("<I", data, 4)[0]
    want = {"amd64": 0x01000007, "arm64": 0x0100000C}[goarch]
    if cpu != want:
        fail(f"cputype={cpu:#x}, esperado {want:#x}")


def check_pe(data, goarch):
    if data[:2] != b"MZ":
        fail("não é PE")
    pe = struct.unpack_from("<I", data, 0x3C)[0]
    if data[pe:pe + 4] != b"PE\0\0":
        fail("cabeçalho PE inválido")
    machine = struct.unpack_from("<H", data, pe + 4)[0]
    want = {"amd64": 0x8664, "arm64": 0xAA64}[goarch]
    if machine != want:
        fail(f"Machine={machine:#x}, esperado {want:#x}")


def main():
    if len(sys.argv) != 4:
        fail("uso: check_binary.py <goos> <goarch> <arquivo>")
    goos, goarch, path = sys.argv[1:]
    if not os.path.isfile(path) or os.path.getsize(path) == 0:
        fail(f"{path} não existe ou está vazio")
    with open(path, "rb") as f:
        data = f.read()
    try:
        if goos in ("linux", "android"):
            if data[:4] != b"\x7fELF":
                fail("não é ELF")
            check_elf(data, goos, goarch)
        elif goos == "darwin":
            check_macho(data, goarch)
        elif goos == "windows":
            check_pe(data, goarch)
        else:
            fail(f"goos desconhecido: {goos}")
    except (struct.error, IndexError):
        fail("arquivo truncado ou corrompido")
    print(f"OK {goos}/{goarch}: {path} ({len(data)} bytes)")


if __name__ == "__main__":
    main()
