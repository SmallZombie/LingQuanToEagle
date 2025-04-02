const FS = require('fs');
const TAR = require('tar');
const PATH = require('path');
const { pinyin: PINYIN } = require("pinyin-pro");
const ARCHIVER = require('archiver');


console.log('LingQuanToEagle v1.0 By SmallZombie\n');

if (!FS.existsSync(PATH.join(__dirname, 'input.lqpack'))) {
    console.error('未找到输入文件，请将要转换的素材包重命名为 "input.lqpack" 然后放在同路径下。');
    process.exit(1);
}

if (FS.existsSync('output.eaglepack')) {
    console.error('输出文件已存在，请确保 "output.eaglepack" 不存在。');
    process.exit(1);
}


console.log('[!] 准备...');
if (FS.existsSync('temp')) {
    FS.rmSync('temp', { recursive: true, force: true });
}

FS.mkdirSync('temp');
FS.mkdirSync('temp/input');
FS.mkdirSync('temp/output');
const inputPath = PATH.join(__dirname, 'temp', 'input');
const outputPath = PATH.join(__dirname, 'temp', 'output');
console.log('[√] 准备完成');


console.log('\n[!] 开始解压...');
FS.mkdirSync(inputPath, { recursive: true });
TAR.x({
    file: 'input.lqpack',
    sync: true,
    C: inputPath,
    onentry: e => console.log(`    解压 "${e.path}"`)
});
console.log('[√] 解压完成');


console.log('\n[!] 寻找跟目录...');
const lQRootPath = getLQRootPath(inputPath);
if (!lQRootPath) {
    console.error('未找到有效的零泉素材包，请检查 "input.lqpack" 是否正确。');
    process.exit(0);
}
console.log(`[√] 已找到 "${lQRootPath}"`);


console.log('\n[!] 加载文件...');
const f_eagle_pack = {
    images: []
}

const f_lq_info = require(PATH.join(lQRootPath, 'materialPackage', 'info.json'));
if (f_lq_info.folders) f_eagle_pack.folder = {
    id: guid(),
    name: '从零泉导入',
    description: '',
    children: [],
    modificationTime: new Date().getTime(),
    pinyin: 'conglingquandaoru'
}
console.log('[√] 加载完成');


// 老 ID 与新 ID 的对应关系
const folderIDMap = new Map();
if (f_lq_info.folders) {
    console.log('\n[!] 转换文件夹...');
    for (const i of f_lq_info.folders) {
        f_eagle_pack.folder.children.push(handleFolder(i, folderIDMap));
    }
    console.log('[√] 转换完成');
}


console.log('\n[!] 转换文件...');
const files = FS.readdirSync(PATH.join(lQRootPath, 'resources'));
for (const i of files) {
    const lqData = require(PATH.join(lQRootPath, 'resources', i, '__info.json'));
    console.log('    ' + lqData.name);

    const eagleData = {
        id: guid(),
        name: lqData.name,
        size: lqData.size,
        // 创建日期
        btime: lqData.time,
        // 修改日期
        mtime: lqData.revisionTime,
        ext: lqData.ext,
        tags: lqData.tags,
        folders: f_lq_info.folders ? lqData.folders.map(v => folderIDMap.get(v)) : [],
        isDeleted: lqData.delete,
        url: lqData.url,
        annotation: lqData.note,
        // 添加日期
        modificationTime: new Date().getTime(),
        star: lqData.score,
        height: lqData.height,
        width: lqData.width,
        lastModified: lqData.revisionTime,
        // 颜色和预览图导入后自动生成
        palettes: []
    }
    // console.log(eagleData);

    FS.mkdirSync(PATH.join(outputPath, eagleData.id + '.info'));
    FS.writeFileSync(PATH.join(outputPath, eagleData.id + '.info', 'metadata.json'), JSON.stringify(eagleData));
    FS.renameSync(
        PATH.join(lQRootPath, 'resources', i, `${lqData.name}${lqData.ext ? '.' + lqData.ext : ''}`),
        PATH.join(outputPath, eagleData.id + '.info', `${eagleData.name}${eagleData.ext ? '.' + eagleData.ext : ''}`)
    );

    f_eagle_pack.images.push(eagleData);
}
console.log(`[√] 转换完成 (${files.length})`);


console.log('\n[!] 保存清单...');
FS.writeFileSync(PATH.join(outputPath, 'pack.json'), JSON.stringify(f_eagle_pack));
console.log('[√] 保存完成');


console.log('\n[!] 压缩...');
async function archiverAndClean() {
    await new Promise(resolve => {
        const output = FS.createWriteStream('output.eaglepack');
        const zip = ARCHIVER('zip', {
            zlib: { level: 9 },
            forceLocalTime: true
        });

        output.on('close', resolve);
        zip.on('error', e => {
            console.log('[X] 压缩失败：' + e);
            throw e;
        });

        zip.pipe(output);
        zip.directory(outputPath, false);
        zip.finalize();
    });
    console.log(`[√] 压缩完成 "${PATH.join(__dirname, 'output.eaglepack')}"`);


    console.log('\n[!] 清理...');
    FS.rmSync('temp', { recursive: true, force: true });
    console.log('[√] 清理完成');
}
archiverAndClean();




function getLQRootPath(path) {
    while (true) {
        // 列出全部的文件夹
        const folders = FS.readdirSync(path);
        if (folders.length === 0) {
            console.error('未找到有效的零泉素材包，请检查 "input.lqpack" 是否正确。');
            return;
        }

        if (folders.includes('materialPackage')) {
            return path;
        } else path = PATH.join(path, folders[0]);
    }
}

function handleFolder(data, map) {
    console.log('    ' + data.name);
    const id = guid();
    map.set(data.id, id);

    return {
        id,
        name: data.name,
        description: data.note,
        children: data.children.map(v => handleFolder(v, map)),
        modificationTime: data.mTime,
        pinyin: PINYIN('测试', {
            toneType: 'none',
            type: 'array'
        }).join(''),
        tags: [],
        extendTags: []
    }
}

/** 生成不重复的 ID */
function guid() {
    return (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)).toUpperCase();
}
