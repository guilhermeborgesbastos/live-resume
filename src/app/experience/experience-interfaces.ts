export interface IExperience {
    id: number;
    position: number;
    role: string;
    companyName: string;
    city: string;
    internationalizations: IExperienceInternationalization[];
    startAt: string; // For the purpose of stringifying MM-DD-YYYY date format
    endAt?: string;  // For the purpose of stringifying MM-DD-YYYY date format
    technologies?: string[];
    medias?: IExperienceMedia[];
    backgroundUrl?: string
}

export interface IExperienceInternationalization {
    language: string;
    country: string;
    description: string;
}

export interface IExperienceMedia {
    icon: string; // Use the official names of Brand Icons (https://www.w3schools.com/icons/fontawesome_icons_brand.asp)
    title: string;
    http: string;
}