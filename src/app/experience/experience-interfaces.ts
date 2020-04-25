export interface IExperience {
    id: number;
    position: number;
    role: string;
    companyName: string;
    location: string;
    descriptions: IExperienceDescription[];
    startAt: string; // For the purpose of stringifying MM-DD-YYYY date format
    endAt?: string;  // For the purpose of stringifying MM-DD-YYYY date format
    technologies?: string[];
    medias?: IExperienceMedia[];
    backgroundUrl?: string
}

export interface IExperienceDescription {
    language: string;
    description: string;
}

export interface IExperienceMedia {
    icon: string; // Use the official names of Brand Icons (https://www.w3schools.com/icons/fontawesome_icons_brand.asp)
    title: string;
    http: string;
}