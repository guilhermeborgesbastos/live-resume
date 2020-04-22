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
    linkedInUrl?: string;
    websiteUrl?: string;
    facebookUrl?: string;
}

export interface IExperienceDescription {
    language: string;
    description: string;
}