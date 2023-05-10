const { series, src, dest, symlink } = require('gulp');
const { rm } = require('fs/promises');

const clean = async () => {
    return rm('./dist', {recursive: true})
    .catch((err) => {
        if (err instanceof Error && err.code === 'ENOENT') {
            // ignore missing dir
            return;
        }

        else throw err;
    });
};

const build = () => {
    return src([
        'package.json',
        'package-lock.json',
        'src/**/*.js',
        'src/**/*.yaml',
        'src/**/*.yml',
        'certs/**/*',
        'db/**/*',
        '.sequelizerc',
        '.npmrc'
    ], {base: './'})

    .pipe(dest('./dist'));
};

exports.build = series(clean, build);
exports.clean = clean;
exports.default = series(clean, build);