#!/bin/bash
# 密藏阁 AAB 构建管线（aapt2 proto-format + bundletool，零 gradle 依赖）
# 用法: bash tools/build_aab.sh [输出文件名]
set -e
cd /home/z/my-project/mikkyo-app

SDK=/home/z/buildtools/android-sdk
BT=$SDK/build-tools/34.0.0
PLATFORM=$SDK/platforms/android-36/android.jar
BUNDLETOOL=/home/z/buildtools/bundletool/bundletool.jar
JDK=/home/z/buildtools/jdk17/bin
SRC=android/src
OUT=android/build-aab
AAB="${1:-密藏阁-v1.2.1.aab}"

rm -rf $OUT && mkdir -p $OUT/module/manifest $OUT/module/dex $OUT/unz

echo "== 同步 web 资源到 assets =="
rm -rf android/assets && mkdir -p android/assets
cp -r web/* android/assets/

echo "== 1/6 aapt2 compile =="
$BT/aapt2 compile --dir $SRC/res -o $OUT/res.zip

echo "== 2/6 aapt2 link --proto-format =="
$BT/aapt2 link --proto-format -o $OUT/proto.apk -I $PLATFORM \
  --manifest $SRC/AndroidManifest.xml $OUT/res.zip -A android/assets

echo "== 3/6 组装 base module =="
cd $OUT
unzip -q proto.apk -d unz
mv unz/AndroidManifest.xml module/manifest/
mv unz/resources.pb module/resources.pb
cp -r unz/res module/
cp -r unz/assets module/
cp ../build/dex/classes.dex module/dex/ 2>/dev/null || true
if [ ! -f module/dex/classes.dex ]; then
  # dex 由主管线复用（build_apk.sh 已生成），否则现编
  mkdir -p $OUT/classes
  export PATH=$JDK:$PATH
  javac -source 11 -target 11 -Xlint:-options -classpath $PLATFORM \
    -d $OUT/classes $(find $SRC/java -name '*.java') 2>/dev/null
  $BT/d8 --release --lib $PLATFORM --min-api 26 --output module/dex \
    $(find $OUT/classes -name '*.class') 2>/dev/null || \
  $BT/d8 --release --lib $PLATFORM --min-api 26 --output module/dex \
    $(find $OUT/classes -name '*.class')
fi

echo "== 4/6 打 module zip =="
cd module && zip -q -r ../base.zip . && cd ..

echo "== 5/6 bundletool build-bundle =="
$JDK/java -jar $BUNDLETOOL build-bundle --modules=base.zip --output=unsigned.aab

echo "== 6/6 jarsigner 上传密钥签名 =="
$JDK/jarsigner -keystore ../mizangge.jks -storepass "${KS_PASS:?请设置KS_PASS环境变量}" \
  -keypass "${KS_PASS}" -sigalg SHA256withRSA -digestalg SHA-256 \
  -signedjar "/home/z/my-project/mikkyo-app/$AAB" unsigned.aab mizangge

echo "== 完成: /home/z/my-project/mikkyo-app/$AAB =="
