#!/bin/bash
# 密藏阁 APK 手动构建管线（零 gradle 依赖）
set -e
cd /home/z/my-project/mikkyo-app

SDK=/home/z/buildtools/android-sdk
BT=$SDK/build-tools/34.0.0
PLATFORM=$SDK/platforms/android-34/android.jar
SRC=android/src
OUT=android/build
APK="${APK:-密藏阁-v1.0.apk}"

rm -rf $OUT && mkdir -p $OUT/classes $OUT/dex

echo "== 同步 web 资源到 assets =="
rm -rf android/assets && mkdir -p android/assets
cp -r web/* android/assets/

echo "== 1/6 aapt2 compile =="
$BT/aapt2 compile --dir $SRC/res -o $OUT/res.zip

echo "== 2/6 aapt2 link =="
$BT/aapt2 link -o $OUT/base.apk -I $PLATFORM \
  --manifest $SRC/AndroidManifest.xml $OUT/res.zip -A android/assets

export PATH=/home/z/buildtools/jdk17/bin:$PATH
echo "== 3/6 javac =="
javac -source 11 -target 11 -Xlint:-options -classpath $PLATFORM \
  -d $OUT/classes $(find $SRC/java -name '*.java')

echo "== 4/6 d8 =="
$BT/d8 --release --lib $PLATFORM --min-api 26 --output $OUT/dex \
  $(find $OUT/classes -name '*.class')

echo "== 5/6 打包 dex =="
python3 - "$OUT/base.apk" "$OUT/dex/classes.dex" << 'PYEOF'
import sys, zipfile
apk, dex = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(apk, 'a', zipfile.ZIP_DEFLATED) as z:
    z.write(dex, 'classes.dex')
print('classes.dex added')
PYEOF

echo "== 6/6 zipalign + 签名 =="
$BT/zipalign -f 4 $OUT/base.apk $OUT/aligned.apk

KS=android/mizangge.jks
if [ ! -f $KS ]; then
  echo "生成新签名密钥…"
  keytool -genkeypair -alias mizangge -keyalg RSA -keysize 2048 -validity 10950 \
    -dname "CN=Mizangge, OU=Mikkyo, O=Mizangge, L=Shanghai, C=CN" \
    -keystore $KS -storepass mizangge2026 -keypass mizangge2026 >/dev/null 2>&1
  echo "mizangge2026" > android/KEYSTORE.txt
fi

$BT/apksigner sign --ks $KS --ks-key-alias mizangge \
  --ks-pass pass:mizangge2026 --key-pass pass:mizangge2026 \
  --out "$APK" $OUT/aligned.apk

$BT/apksigner verify --print-certs "$APK" | head -4
echo "== 完成: $(pwd)/$APK ($(du -h "$APK" | cut -f1)) =="
