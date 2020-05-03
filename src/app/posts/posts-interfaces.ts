export interface IPost {
    thumbnail: string
    http: string;
    date: string; // For the purpose of stringifying MM-DD-YYYY date format
    internationalizations: IPostInternationalization[];
}

export interface IPostInternationalization {
    language: string;
    title: string;
    description: string;
}