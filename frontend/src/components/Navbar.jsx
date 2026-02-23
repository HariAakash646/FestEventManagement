import React from "react";
import {
    Badge,
    Box,
    Button,
    Container,
    Flex,
    HStack,
    Link as ChakraLink,
    Text,
} from "@chakra-ui/react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const Navbar = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const homePathByRole = {
        Admin: "/admin",
        Participant: "/",
        Organizer: "/organizer",
    };
    const homePath = user ? homePathByRole[user.role] : null;

    const isActive = (path) => location.pathname === path;

    const linkStyle = (path) => ({
        px: 3,
        py: 1.5,
        borderRadius: "full",
        fontWeight: "semibold",
        color: isActive(path) ? "teal.700" : "gray.700",
        bg: isActive(path) ? "teal.100" : "transparent",
        transition: "all 0.2s ease",
        _hover: {
            textDecoration: "none",
            bg: isActive(path) ? "teal.200" : "gray.100",
        },
    });

    return (
        <Container maxW="1140px" px={4} py={4}>
            <Flex
                minH={16}
                alignItems="center"
                justifyContent="space-between"
                flexDir={{ base: "column", md: "row" }}
                gap={{ base: 3, md: 4 }}
                px={{ base: 4, md: 5 }}
                py={{ base: 3, md: 2.5 }}
                borderRadius="2xl"
                border="1px solid"
                borderColor="gray.200"
                bgGradient="linear(to-r, white, teal.50)"
                boxShadow="sm"
            >
                <HStack gap={2} flexWrap="wrap" justifyContent={{ base: "center", md: "start" }}>
                    {homePath && (
                        <ChakraLink as={RouterLink} to={homePath} {...linkStyle(homePath)}>
                            Home
                        </ChakraLink>
                    )}
                    
                    {!user && (
                        <>
                            <ChakraLink as={RouterLink} to="/register" {...linkStyle("/register")}>
                                Register
                            </ChakraLink>
                            <ChakraLink as={RouterLink} to="/login" {...linkStyle("/login")}>
                                Login
                            </ChakraLink>
                        </>
                    )}

                    {user && user.role == 'Admin' && (
                        <ChakraLink as={RouterLink} to="/admin/register" {...linkStyle("/admin/register")}>
                            Register Organizer
                        </ChakraLink>
                    )}

                    {user && user.role == 'Admin' && (
                        <ChakraLink as={RouterLink} to="/admin/organizers" {...linkStyle("/admin/organizers")}>
                            Manage Organizers
                        </ChakraLink>
                    )}

                    {user && user.role == 'Admin' && (
                        <ChakraLink as={RouterLink} to="/admin/password-reset-requests" {...linkStyle("/admin/password-reset-requests")}>
                            Password Reset Requests
                        </ChakraLink>
                    )}

                    {user && user.role == 'Organizer' && (
                        <ChakraLink as={RouterLink} to="/organizer/create" {...linkStyle("/organizer/create")}>
                            Create Event
                        </ChakraLink>
                    )}

                    {user && user.role == 'Organizer' && (
                        <ChakraLink as={RouterLink} to="/organizer/profile" {...linkStyle("/organizer/profile")}>
                            Profile
                        </ChakraLink>
                    )}

                    {user && user.role == 'Participant' && (
                        <ChakraLink as={RouterLink} to="/participant/browse-events" {...linkStyle("/participant/browse-events")}>
                            Browse Events
                        </ChakraLink>
                    )}

                    {user && user.role == 'Participant' && (
                        <ChakraLink as={RouterLink} to="/participant/profile" {...linkStyle("/participant/profile")}>
                            Profile
                        </ChakraLink>
                    )}

                    {user && user.role == 'Participant' && (
                        <ChakraLink as={RouterLink} to="/participant/organizers" {...linkStyle("/participant/organizers")}>
                            Clubs / Organizers
                        </ChakraLink>
                    )}

                    {user && (
                        <Button
                            size="sm"
                            colorPalette="teal"
                            variant="solid"
                            borderRadius="full"
                            onClick={logout}
                        >
                            Logout
                        </Button>
                    )}

                    
                </HStack>

                {user && user.role === "Participant" && (
                    <HStack gap={2}>
                        <Badge colorPalette="teal" variant="subtle" borderRadius="full" px={2.5} py={1}>
                            Logged In
                        </Badge>
                        <Text fontSize="sm" color="gray.700" fontWeight="medium">
                            Hello, <Box as="span" color="teal.700">{user.firstName}</Box>
                        </Text>
                    </HStack>
                )}
            </Flex>
        </Container>
    );
};

export default Navbar;
