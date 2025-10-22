export interface TestUser {
  email: string;
  name: string;
  id?: string;
  token?: string;
  isNewUser?: boolean;
}

export interface TestFamily {
  name: string;
  inviteCode?: string;
  id?: string;
}

export interface TestChild {
  name: string;
  age: number;
  id?: string;
}

export interface TestVehicle {
  name: string;
  capacity: number;
  id?: string;
}

export const TEST_USERS: Record<string, TestUser> = {
  ADMIN: {
    email: 'admin.test@edulift.com',
    name: 'Admin Test User'
  },
  PARENT1: {
    email: 'parent1.test@edulift.com', 
    name: 'Parent One'
  },
  PARENT2: {
    email: 'parent2.test@edulift.com',
    name: 'Parent Two'
  },
  MEMBER: {
    email: 'member.test@edulift.com',
    name: 'Family Member'
  }
};

export const TEST_FAMILIES: Record<string, TestFamily> = {
  SMITH: {
    name: 'The Smith Family'
  },
  JOHNSON: {
    name: 'Johnson Family'
  }
};

export const TEST_CHILDREN: Record<string, TestChild> = {
  EMMA: {
    name: 'Emma Smith',
    age: 8
  },
  NOAH: {
    name: 'Noah Smith', 
    age: 10
  },
  OLIVIA: {
    name: 'Olivia Johnson',
    age: 7
  }
};

export const TEST_VEHICLES: Record<string, TestVehicle> = {
  HONDA_CRV: {
    name: 'Honda CR-V',
    capacity: 7
  },
  TOYOTA_SIENNA: {
    name: 'Toyota Sienna',
    capacity: 8
  },
  VOLKSWAGEN_ATLAS: {
    name: 'Volkswagen Atlas',
    capacity: 7
  }
};