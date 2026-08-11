/** Расширения файлов этапа, для которых показываем разметку Annotorious. */
export function isStageImageFilename(filename: string): boolean {
    return /\.(jpe?g|png|gif|webp)$/i.test(filename)
}
