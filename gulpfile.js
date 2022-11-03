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
        'src/**/*.js',
        'src/**/*.yaml',
        'src/**/*.yml',
        'certs/**/*',
        'db/**/*',
        '.sequelizerc'
    ], {base: './'})

    .pipe(dest('./dist'));
}

exports.build = build;
exports.clean = clean;
exports.default = series(clean, build);