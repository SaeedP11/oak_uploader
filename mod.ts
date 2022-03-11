/* Import */
// Local
import { join, ensureDirSync, moveSync } from './deps.ts';
/* Types */
interface Options {
    path?: string,
    max_file?: number,
    files?: string[],
    extensions?: string[],
    max_file_size?: number,
    random_name?: boolean,
    datetime_subdir?: boolean,
    move?: boolean,
    errors?: {
        max_file?: string,
        extension?: string,
        size?: string
    }
}
interface Files {
    [key: string]: SingleFile;
}
interface Errors {
    [key: string]: string[];
}
interface SingleFile {
    original_name: string;
    name: string;
    random_name?: string;
    // detail
    extension: string;
    size: number;
    // url
    tmp_url: string;
    dir?: string;
    url?: string;
    uri?: string;
}
/* Variables */
const default_options = {
    path: undefined,
    max_file: undefined,
    files: undefined,
    extensions: undefined,
    max_file_size: undefined,
    random_name: false,
    datetime_subdir: false,
    move: false,
    errors: {
        max_file: "NUMBER OF FILES IS NOT ALLOWED",
        extension: "EXT IS NOT ALLOWED",
        size: "SIZE IS NOT ALLOWED"
    }
};
/* Functions */
// upload
function upload(options: Options = default_options) {
    return async (ctx: any, next: CallableFunction) => {
        const files: Files = {};
        const errors: Errors = { formdata: [] };
        //
        if (options) {
            options = {
                ...default_options , ...options,
                errors: {
                    max_file: options.errors && options.errors.max_file ? options.errors.max_file : default_options.errors.max_file,
                    extension: options.errors && options.errors.extension ? options.errors.extension : default_options.errors.extension,
                    size: options.errors && options.errors.size ? options.errors.size : default_options.errors.size
                }
            };
        }
        // 
        const boundary_regex = /^multipart\/form-data;\sboundary=(?<boundary>.*)$/;
        // 
        if (
            ctx.request.headers.get('content-type') &&
            ctx.request.headers.get('content-type').match(boundary_regex)
        ) {
            const body = await ctx.request.body({ type: "form-data" });
            const form_data = await body.value.read();
            // 
            if (form_data.files) {
                if (!options.max_file || (options.max_file >= form_data.files.length)) {
                    let find;
                    let stat;
                    let file_errors: string[] = [];
                    let parts;
                    let file: SingleFile;
                    let datetime: Date = new Date();
                    let dir: string = "";
                    // 
                    let file_list = [];
                    if (options.files) {
                        let target_files: any[] = [];
                        let finded_file;
                        options.files.forEach(name => {
                            file_errors = [];
                            finded_file = form_data.files.find((file: any) => file.name === name);

                            if (finded_file) {
                                target_files.push(finded_file);
                            }
                            else {
                                file_errors.push(`FILE ${name} NOT FOUND`);
                                errors[name] = file_errors;
                            }
                        });

                        file_list = target_files;
                    }
                    else {
                        file_list = form_data.files;
                    }
                    // 
                    for (let i = 0; i < file_list.length; i++) {
                        stat = await Deno.stat(file_list[i].filename);
                        parts = file_list[i].originalName.split('.');
                        file = {
                            original_name: file_list[i].originalName,
                            name: parts[0],
                            extension: parts.pop().toLowerCase(),
                            size: stat.size / 1048576,
                            tmp_url: file_list[i].filename
                        }
                        /* Check options */
                        file_errors = [];
                        // random_name
                        if (options.random_name) {
                            file.random_name = `${crypto.randomUUID() }-${file.original_name}`;
                        }
                        // extensions
                        if (options.extensions && options.extensions.length) {
                            if (!options.extensions.includes(file.extension) && (options.errors && options.errors.extension)) {
                                file_errors.push(options.errors.extension);
                            }
                        }
                        // max_file_size
                        if (options.max_file_size) {
                            if (options.max_file_size < file.size && (options.errors && options.errors.size)) {
                                file_errors.push(options.errors.size);
                            }
                        }
                        // path
                        if (options.path) {
                            // datetime_subdir
                            if (options.datetime_subdir) {
                                dir = join(
                                    options.path,
                                    datetime.getFullYear().toString(),
                                    datetime.getMonth().toString(),
                                    datetime.getDate().toString(),
                                    datetime.getHours().toString(),
                                    datetime.getMinutes().toString(),
                                    datetime.getSeconds().toString()
                                );
                            }
                            else {
                                dir = join(options.path);
                            }
    
                            ensureDirSync(dir);
    
                            file.url = join(dir, `${crypto.randomUUID()}-${file.random_name ? file.random_name : file.original_name}`);
                            file.uri = join(Deno.cwd(), file.url);
                        }
                        // move
                        if (!file_errors.length && options.move) {
                            moveSync(file.tmp_url, `${Deno.cwd()}/${file.url}`);
                        }
                        // Push to files
                        if (!file_errors.length) {
                            files[form_data.files[i].name] = file;
                        }
                        else {
                            errors[form_data.files[i].name] = file_errors;
                        }
                    }
                }
                else if (options.errors && options.errors.max_file) {
                    errors['formdata'].push(options.errors.max_file);
                }
            }
            else {
                errors['formdata'].push("FILES NOT FOUND");
            }
        }
        else {
            errors['formdata'].push("FORMDATA NOT FOUND");
        }
        // Final Stage
        ctx.feno = {
            files: files,
            errors: errors.formdata.length || Object.keys(errors).length > 1 ? errors : undefined
        }
        
        await next();
    }
}
/* Export */
export { upload }
