export interface IAbout {
    internationalizations: IAboutInternationalization[];
    medias?: IAboutMedia[];
    hobbies?: IAboutHobby[];
    education?: IAboutEducation[];
    certifications?: IAboutCertification[];
    languages?: IAboutLanguage[];
    topics?: IAboutTopic[];
}

export interface IAboutLocalized {
    language: string;
    [field: string]: string;
}

export interface IAboutEducation {
    school: string;
    startAt?: string; // YYYY
    endAt?: string; // YYYY
    internationalizations: IAboutLocalized[]; // degree, fieldOfStudy
}

export interface IAboutCertification {
    name: string;
    issuer: string;
    type: "certification" | "course" | "badge";
    issuedAt: string; // MM-YYYY or YYYY
    expiresAt?: string;
    url?: string;
}

export interface IAboutLanguage {
    code: string;
    internationalizations: IAboutLocalized[]; // name, proficiency
}

export interface IAboutTopic {
    id: string;
    aliases: string[];
    experienceIds: number[];
    internationalizations: IAboutLocalized[]; // name, summary
}

export interface IAboutInternationalization {
    language: string;
    description: string;
}

export interface IAboutMedia {
    icon: string; // Use the official names of Brand Icons (https://www.w3schools.com/icons/fontawesome_icons_brand.asp)
    title: string;
    http: string;
}

export interface IAboutHobby {
    icon: string; // Use the official names of Brand Icons (https://www.w3schools.com/icons/fontawesome_icons_brand.asp)
    title: string;
}