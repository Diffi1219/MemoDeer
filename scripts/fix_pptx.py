"""Fix pptxgenjs phantom slideMaster entries in [Content_Types].xml.
Modifies only [Content_Types].xml in-place — does NOT rewrite the entire ZIP.
"""
import zipfile, re, sys, os, io

src = sys.argv[1]

with zipfile.ZipFile(src, 'r') as z:
    # Read the files that might need fixing
    ct_raw = z.read('[Content_Types].xml')
    ct = ct_raw.decode('utf-8')
    pres_raw = z.read('ppt/presentation.xml')
    pres = pres_raw.decode('utf-8')

    # Check for phantom slideMaster Override entries in Content_Types
    phantom_ct = re.findall(
        r'<Override PartName="/ppt/slideMasters/slideMaster[2-9]\d*\.xml"\s+ContentType="[^"]*"/>',
        ct
    )

    # Check for phantom sldMasterId entries in presentation.xml
    phantom_pres = re.findall(
        r'<p:sldMasterId\s+id="(?!2147483648")(\d+)"\s+r:id="[^"]*"/>',
        pres
    )

    if not phantom_ct and not phantom_pres:
        print('No phantom slideMaster entries found — nothing to fix.')
        sys.exit(0)

    print(f'Found {len(phantom_ct)} phantom Override(s) in Content_Types, '
          f'{len(phantom_pres)} phantom sldMasterId(s) in presentation.xml')

    # Collect directories we need to preserve (OOXML expects them)
    dirs = set()
    for info in z.infolist():
        if info.is_dir():
            dirs.add(info.filename)

    # Read all file contents
    files = {}
    for info in z.infolist():
        if not info.is_dir():
            data = z.read(info.filename)
            files[info.filename] = data

    # Apply fixes
    if phantom_ct:
        for entry in phantom_ct:
            ct = ct.replace(entry, '')
        # Clean up double spaces that may result
        ct = re.sub(r'\s{2,}', ' ', ct)
        ct = re.sub(r'\s+/>', ' />', ct)
        files['[Content_Types].xml'] = ct.encode('utf-8')
        print('  Removed phantom Override entries from [Content_Types].xml')

    if phantom_pres:
        for entry in phantom_pres:
            pres = pres.replace(entry, '')
        files['ppt/presentation.xml'] = pres.encode('utf-8')
        print('  Removed phantom sldMasterId entries from presentation.xml')

# Write fixed ZIP — all STORED to match pptxgenjs original style
# [Content_Types].xml MUST be STORED per OOXML spec
# Directory entries are also required by OOXML (PowerPoint repairs files without them)
tmp = src + '.tmp'
with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_STORED) as zout:
    # Write directories first, matching original ordering
    for d in sorted(dirs):
        zout.writestr(d, b'', compress_type=zipfile.ZIP_STORED)
    # Write [Content_Types].xml first (OOXML spec requires it be the first file)
    ct_data = files.pop('[Content_Types].xml', None)
    if ct_data:
        zout.writestr('[Content_Types].xml', ct_data, compress_type=zipfile.ZIP_STORED)
    # Write remaining files
    for name, data in files.items():
        zout.writestr(name, data, compress_type=zipfile.ZIP_STORED)

os.replace(tmp, src)
print('Fixed successfully.')
