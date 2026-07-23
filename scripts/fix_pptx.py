"""Fix pptxgenjs phantom slideMaster entries that cause PowerPoint repair warnings."""
import zipfile, re, sys, os

src = sys.argv[1]

with zipfile.ZipFile(src, 'r') as z:
    files = {}
    for name in z.namelist():
        if not name.endswith('/'):
            files[name] = z.read(name)

# Fix 1: Remove phantom slideMaster overrides from [Content_Types].xml
ct = files['[Content_Types].xml'].decode('utf-8')
ct = re.sub(
    r'<Override PartName="/ppt/slideMasters/slideMaster[2-9]\d*\.xml"\s+ContentType="[^"]*"/>',
    '', ct
)
files['[Content_Types].xml'] = ct.encode('utf-8')

# Fix 2: In presentation.xml, keep only the first sldMasterId (id="2147483648")
pres = files['ppt/presentation.xml'].decode('utf-8')
pres = re.sub(
    r'<p:sldMasterId\s+id="(?!2147483648")(\d+)"\s+r:id="[^"]*"/>',
    '', pres
)
files['ppt/presentation.xml'] = pres.encode('utf-8')

with zipfile.ZipFile(src, 'w', zipfile.ZIP_DEFLATED) as zout:
    for name, data in files.items():
        zout.writestr(name, data)

print('Phantom slideMaster entries removed.')
