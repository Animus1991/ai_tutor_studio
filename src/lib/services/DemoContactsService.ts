export interface Contact {
  name: string;
  email: string;
  photoUrl?: string;
}

export class DemoContactsService {
  private static instance: DemoContactsService;

  private constructor() {}

  public static getInstance(): DemoContactsService {
    if (!DemoContactsService.instance) {
      DemoContactsService.instance = new DemoContactsService();
    }
    return DemoContactsService.instance;
  }

  public async getContacts(): Promise<Contact[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    return [
      { name: "Alice Smith", email: "alice.smith@example.com" },
      { name: "Bob Johnson", email: "bob.johnson@example.com" },
      { name: "Charlie Brown", email: "charlie.brown@example.com" },
      { name: "Diana Prince", email: "diana.prince@example.com" },
      { name: "Evan Wright", email: "evan.wright@example.com" }
    ];
  }
}

export const contactsService = DemoContactsService.getInstance();
